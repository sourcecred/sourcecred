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

export type UserId = number;
export type PostId = number;
export type TopicId = number;

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
  +postNumber: number,
  // The postNumber of the post within the same topic that this post was a
  // reply to. Will be `null` if this post was the first post, or if it was a
  // reply to the first post.
  +replyToPostNumber: number | null,
  +timestampMs: number,
  +authorUsername: string,
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

/**
 * Interface over the external Discourse API, structured to suit our particular needs.
 * We have an interface (as opposed to just an implementation) to enable easy mocking and
 * testing.
 */
export interface DiscourseInterface {
  // Get the `id` of the latest topic on the server.
  // Vital so that we can then enumerate and fetch every Topic we haven't seen yet.
  latestTopicId(): Promise<TopicId>;
  // Retrieve the Topic with Posts for a given id. May be null, either because the
  // topic is hidden from the api user, or it 404s. (Not sure why this happens.)
  topicWithPosts(id: TopicId): Promise<TopicWithPosts | null>;
  // Retrieve an individual Post by its id. May be null, e.g. because the post is
  // hidden from the api user.
  post(id: PostId): Promise<Post | null>;
  // Retrieve the latest posts from the server.
  // Vital so that we can then enumerate and fetch every Post that we haven't
  // encountered.
  latestPosts(): Promise<$ReadOnlyArray<Post>>;
}

export class DiscourseFetcher implements DiscourseInterface {
  +options: DiscourseFetchOptions;
  +_fetchImplementation: typeof fetch;

  constructor(
    options: DiscourseFetchOptions,
    // fetchImplementation shouldn't be provided by clients, but is convenient for testing.
    fetchImplementation?: typeof fetch
  ) {
    this.options = options;
    this._fetchImplementation = fetchImplementation || fetch;
  }

  _fetch(endpoint: string): Promise<Response> {
    const {serverUrl, apiKey, apiUsername} = this.options;
    if (!endpoint.startsWith("/")) {
      throw new Error(`invalid endpoint: ${endpoint}`);
    }
    if (!serverUrl.startsWith("http") || serverUrl.endsWith("/")) {
      throw new Error(`invalid server url: ${serverUrl}`);
    }
    const fetchOptions = {
      method: "GET",
      headers: {
        "Api-Key": apiKey,
        "Api-Username": apiUsername,
        "Content-Type": "application/json",
      },
    };
    const fullUrl = `${serverUrl}${endpoint}`;
    return this._fetchImplementation(fullUrl, fetchOptions);
  }

  async latestTopicId(): Promise<TopicId> {
    const response = await this._fetch("/latest.json?order=created");
    if (response.status === 404) {
      throw new Error(`404 from ${response.url}; maybe bad serverUrl?`);
    }
    if (response.status === 403) {
      const {apiUsername, apiKey} = this.options;
      throw new Error(
        `got status 403; bad api username (${apiUsername}) or key (${apiKey})`
      );
    }
    if (response.status !== 200) {
      throw new Error(`not OK status ${response.status} on ${response.url}`);
    }
    const json = await response.json();
    if (json.topic_list.topics.length === 0) {
      throw new Error(`no topics! got ${stringify(json)} as latest topics.`);
    }
    return json.topic_list.topics[0].id;
  }

  async latestPosts(): Promise<$ReadOnlyArray<Post>> {
    const response = await this._fetch("/posts.json");
    if (response.status === 404) {
      throw new Error(`404 from ${response.url}; maybe bad serverUrl?`);
    }
    if (response.status === 403) {
      const {apiUsername, apiKey} = this.options;
      throw new Error(
        `got status 403; bad api username (${apiUsername}) or key (${apiKey})`
      );
    }
    if (response.status !== 200) {
      throw new Error(`not OK status ${response.status} on ${response.url}`);
    }
    const json = await response.json();
    return json.latest_posts.map(parsePost);
  }

  async topicWithPosts(id: TopicId): Promise<TopicWithPosts | null> {
    const response = await this._fetch(`/t/${id}.json`);
    if (response.status === 404) {
      // Not sure why this happens, but a topic can sometimes 404.
      // We should just consider it unreachable.
      // Here is an example: https://discourse.sourcecred.io/t/116
      return null;
    }
    if (response.status === 403) {
      // Probably this topic is hidden or deleted.
      // Just consider it unreachable.
      // If the issue is that the user provided bad keys, then
      // they will get a more helpful error when they try to get the latest
      // topic id.
      return null;
    }
    if (response.status !== 200) {
      throw new Error(`not OK status ${response.status} on ${response.url}`);
    }
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
    if (response.status === 404) {
      // Since topics can 404, I assume posts can too.
      return null;
    }
    if (response.status === 403) {
      // Probably this post is hidden or deleted.
      return null;
    }
    if (response.status !== 200) {
      throw new Error(`not OK status ${response.status} on ${response.url}`);
    }
    const json = await response.json();
    return parsePost(json);
  }
}

function parsePost(json: any): Post {
  return {
    id: json.id,
    timestampMs: +new Date(json.created_at),
    postNumber: json.post_number,
    replyToPostNumber: json.reply_to_post_number,
    topicId: json.topic_id,
    authorUsername: json.username,
  };
}

export type DiscourseFetchOptions = {|
  apiKey: string,
  // We'll use the view permissions for this user. It needs to be a real user
  // on the server. I recommend making a new user called "credbot" with no
  // special permissions for this purpose. If you use a permissioned user (e.g.
  // "system") then SourceCred will pick up hidden and deleted posts,
  // potentially leaking private information.
  apiUsername: string,
  serverUrl: string,
|};
