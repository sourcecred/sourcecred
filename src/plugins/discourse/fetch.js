// @flow

/**
 * Class for retrieving data from the Discourse API.
 *
 * The Discourse API implements the JSON endpoints for all functionality of the actual site.
 * As such, it tends to return a lot of information that we don't care about (in contrast
 * to a GraphQL API which would give us only what we ask for). As such, we implement a simple
 * interface over it, which both abstracts over calling the API, and does some post-processing
 * on the results to simplify it to data that is relevant for us.
 */

import stringify from "json-stable-stringify";
import fetch from "isomorphic-fetch";
import Bottleneck from "bottleneck";
import * as NullUtil from "../../util/null";

export type UserId = number;
export type PostId = number;
export type TopicId = number;
export type CategoryId = number;

export type Topic = {|
  +id: TopicId,
  +title: string,
  +timestampMs: number,
  +authorUsername: string,
|};

export type Post = {|
  +id: PostId,
  +topicId: TopicId,
  // Which number post this was within the topic (starts at 1)
  +indexWithinTopic: number,
  // The indexWithinTopic of the post within the same topic that this post was a
  // reply to. Will be `null` if this post was the first post, or if it was a
  // reply to the first post.
  +replyToPostIndex: number | null,
  +timestampMs: number,
  +authorUsername: string,
  // The post HTML for rendering.
  +cooked: string,
|};

export type TopicWithPosts = {|
  +topic: Topic,
  // Not guaranteed to contain all the Posts in the topic—clients will need to
  // manually request some posts. The raw response actually includes a list of
  // all the PostIds in the topic, but for now we don't use them.
  //
  // We do use these Posts though, as it allows us to save requesting them all
  // individually.
  +posts: $ReadOnlyArray<Post>,
|};

export type LikeAction = {|
  // The user who liked something
  +username: string,
  // The post being liked
  +postId: PostId,
  +timestampMs: number,
|};

/**
 * Interface over the external Discourse API, structured to suit our particular needs.
 * We have an interface (as opposed to just an implementation) to enable easy mocking and
 * testing.
 */
export interface Discourse {
  // Get the `id` of the latest topic on the server.
  // Vital so that we can then enumerate and fetch every Topic we haven't seen yet.
  // May reject on not OK status like 404 or 403.
  latestTopicId(): Promise<TopicId>;
  // Retrieve the Topic with Posts for a given id.
  // Will resolve to null if the response status is 403 or 404. 403 because the
  // topic may be hidden from the API user; 404 because we sometimes see
  // 404s in prod and want to ignore those topic ids. (Not sure why it happens.)
  // May reject if the status is not OK and is not 404 or 403.
  topicWithPosts(id: TopicId): Promise<TopicWithPosts | null>;
  // Retrieve an individual Post by its id.
  // Will resolve to null if the response status is 403 or 404. 403 because the
  // topic may be hidden from the API user; 404 because we sometimes see
  // 404s in prod and want to ignore those topic ids. (Not sure why it happens.)
  // May reject if the status is not OK and is not 404 or 403.
  post(id: PostId): Promise<Post | null>;
  // Retrieve the latest posts from the server.
  // Vital so that we can then enumerate and fetch every Post that we haven't
  // encountered.
  // May reject on not OK status like 404 or 403.
  latestPosts(): Promise<Post[]>;

  /**
   * Retrieves the like actions that were initiated by the target user.
   * May be 404 on the server, which will return a null here.
   */
  likesByUser(
    targetUsername: string,
    offset: number
  ): Promise<LikeAction[] | null>;
}

const MAX_API_REQUESTS_PER_MINUTE = 55;

export class Fetcher implements Discourse {
  // We limit the rate of API requests, as documented here:
  // https://meta.discourse.org/t/global-rate-limits-and-throttling-in-discourse/78612
  // Note this limit is for admin API keys. If we change to user user API keys
  // (would be convenient as the keys would be less sensitive), we will need to lower
  // this rate limit by a factor of 3
  // TODO: I've set the max requests per minute to 55 (below the stated limit
  // of 60) to be a bit conservative, and avoid getting limited by the server.
  // We could improve our throughput by increasing the requests per minute to the
  // stated limit, and incorporating retry logic to account for the occasional 529.

  +options: DiscourseFetchOptions;
  +_fetchImplementation: typeof fetch;

  constructor(
    options: DiscourseFetchOptions,
    // fetchImplementation shouldn't be provided by clients, but is convenient for testing.
    fetchImplementation?: typeof fetch,
    // Used to avoid going over the Discourse API rate limit
    minTimeMs?: number
  ) {
    this.options = options;
    const minTime = NullUtil.orElse(
      minTimeMs,
      (1000 * 60) / MAX_API_REQUESTS_PER_MINUTE
    );
    // n.b. the rate limiting isn't programmatically tested. However, it's easy
    // to tell when it's broken: try to load a nontrivial Discourse server, and see
    // if you get a 429 failure.
    const limiter = new Bottleneck({minTime});
    const unlimitedFetch = NullUtil.orElse(fetchImplementation, fetch);
    this._fetchImplementation = limiter.wrap(unlimitedFetch);
  }

  _fetch(endpoint: string): Promise<Response> {
    const {serverUrl} = this.options;
    if (!endpoint.startsWith("/")) {
      throw new Error(`invalid endpoint: ${endpoint}`);
    }
    if (!serverUrl.startsWith("http") || serverUrl.endsWith("/")) {
      throw new Error(`invalid server url: ${serverUrl}`);
    }
    const fetchOptions = {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    };
    const fullUrl = `${serverUrl}${endpoint}`;
    return this._fetchImplementation(fullUrl, fetchOptions);
  }

  async latestTopicId(): Promise<TopicId> {
    const response = await this._fetch("/latest.json?order=created");
    failIfMissing(response);
    failForNotOk(response);
    const json = await response.json();
    if (json.topic_list.topics.length === 0) {
      throw new Error(`no topics! got ${stringify(json)} as latest topics.`);
    }
    return json.topic_list.topics[0].id;
  }

  async latestPosts(): Promise<Post[]> {
    const response = await this._fetch("/posts.json");
    failIfMissing(response);
    failForNotOk(response);
    const json = await response.json();
    return json.latest_posts.map(parsePost);
  }

  async topicWithPosts(id: TopicId): Promise<TopicWithPosts | null> {
    const response = await this._fetch(`/t/${id}.json`);
    const {status} = response;
    if (status === 403 || status === 404 || status === 410) {
      // The topic is hidden, deleted, or otherwise missing.
      // Example of a 404 topic: https://discourse.sourcecred.io/t/116
      return null;
    }
    failForNotOk(response);
    const json = await response.json();
    const posts = json.post_stream.posts.map(parsePost);
    const topic: Topic = {
      id: json.id,
      title: json.title,
      timestampMs: +new Date(json.created_at),
      authorUsername: json.details.created_by.username,
    };
    return {topic, posts};
  }

  async post(id: PostId): Promise<Post | null> {
    const response = await this._fetch(`/posts/${id}.json`);
    const {status} = response;
    if (status === 403 || status === 404 || status === 410) {
      // The post is hidden, deleted, or otherwise missing.
      return null;
    }
    failForNotOk(response);
    const json = await response.json();
    return parsePost(json);
  }

  async likesByUser(
    username: string,
    offset: number
  ): Promise<LikeAction[] | null> {
    const response = await this._fetch(
      `/user_actions.json?username=${username}&filter=1&offset=${offset}`
    );
    const {status} = response;
    if (status === 404) {
      // The user probably no longer exists. This is expected, see #1440.
      return null;
    }
    failIfMissing(response);
    failForNotOk(response);
    const json = await response.json();
    return json.user_actions.map(parseLike);
  }
}

function failIfMissing(response: Response) {
  if (response.status === 404) {
    throw new Error(`404 Not Found on: ${response.url}; maybe bad serverUrl?`);
  }
  if (response.status === 403) {
    throw new Error(`403 Forbidden: bad API username or key?`);
  }
  if (response.status === 410) {
    throw new Error(`410 Gone`);
  }
}

function failForNotOk(response: Response) {
  if (!response.ok) {
    throw new Error(`not OK status ${response.status} on ${response.url}`);
  }
}

function parsePost(json: any): Post {
  return {
    id: json.id,
    timestampMs: Date.parse(json.created_at),
    indexWithinTopic: json.post_number,
    replyToPostIndex: json.reply_to_post_number,
    topicId: json.topic_id,
    authorUsername: json.username,
    cooked: json.cooked,
  };
}

function parseLike(json: any): LikeAction {
  return {
    username: json.target_username,
    postId: json.post_id,
    timestampMs: Date.parse(json.created_at),
  };
}

export type DiscourseFetchOptions = {|
  serverUrl: string,
|};
