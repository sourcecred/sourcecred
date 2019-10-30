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
  +categoryId: CategoryId,
  +title: string,
  +timestampMs: number,
  +bumpedMs: number | null,
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
  // Retrieve the Topic with Posts for a given id.
  // Will resolve to null if the response status is 403 or 404. 403 because the
  // topic may be hidden from the API user; 404 because we sometimes see
  // 404s in prod and want to ignore those topic ids. (Not sure why it happens.)
  // May reject if the status is not OK and is not 404 or 403.
  topicWithPosts(id: TopicId): Promise<TopicWithPosts | null>;

  /**
   * Retrieves the like actions that were initiated by the target user.
   */
  likesByUser(targetUsername: string, offset: number): Promise<LikeAction[]>;

  // Gets topics ordered by bumped_at date.
  // Will only return topics which have a bumped_at date greater than
  // the one provided in sinceMs.
  topicsBumpedSince(sinceMs: number): Promise<Topic[]>;

  // Gets the topic IDs for every "about-x-category" topic.
  // Discourse calls this a "definition" topic.
  categoryDefinitionTopicIds(): Promise<TopicId[]>;
}

const MAX_API_CONCURRENT = 10;
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
    const limiter = new Bottleneck({
      maxConcurrent: MAX_API_CONCURRENT,
      minTime,
    });
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

  async categoryDefinitionTopicIds(): Promise<TopicId[]> {
    const topicIdRE = new RegExp("/t/[\\w-]+/(\\d+)$");
    const urls = [];
    const withSubs = [];

    // Root categories
    const response = await this._fetch(
      `/categories.json?show_subcategory_list=true`
    );
    failIfMissing(response);
    failForNotOk(response);
    const {categories: rootCategories} = (await response.json()).category_list;
    for (const cat of rootCategories) {
      if (cat.topic_url != null) {
        urls.push(cat.topic_url);
      }
      if (cat.subcategory_ids) {
        withSubs.push(cat.id);
      }
    }

    // Subcategories
    for (const rootCatId of withSubs) {
      const subResponse = await this._fetch(
        `/categories.json?show_subcategory_list=true&parent_category_id=${rootCatId}`
      );
      failIfMissing(subResponse);
      failForNotOk(subResponse);
      const {
        categories: subCategories,
      } = (await subResponse.json()).category_list;
      for (const cat of subCategories) {
        if (cat.topic_url != null) {
          urls.push(cat.topic_url);
        }
      }
    }

    const ids = urls.map((url) => {
      const match = topicIdRE.exec(url);
      if (match == null) {
        throw new Error(
          `Encountered topic URL we failed to parse it's TopicId from: ${url}`
        );
      }
      return Number(match[1]);
    });
    const uniqueIds = Array.from(new Set(ids).values());
    uniqueIds.sort((a, b) => a - b);
    return uniqueIds;
  }

  async topicsBumpedSince(sinceMs: number): Promise<Topic[]> {
    const topics = [];
    let pastSince = false;
    let morePages = true;
    let page = 0;

    while (!pastSince && morePages) {
      // Note: this will always fail to fetch the "about-x-category" topics.
      // due to https://github.com/discourse/discourse/blob/594925b8965a26c512665371092fec3383320b58/app/controllers/list_controller.rb#L66
      const response = await this._fetch(
        `/latest.json?order=activity&ascending=false&page=${page}`
      );
      failIfMissing(response);
      failForNotOk(response);
      const json = await response.json();
      if (json.topic_list.topics.length === 0) {
        throw new Error(`no topics! got ${stringify(json)} as latest topics.`);
      }
      const {users, topic_list: topicList} = json;
      const {per_page: perPage, topics: resultTopics} = topicList;
      const usernamesById = new Map(users.map((u) => [u.id, u.username]));
      morePages = perPage == resultTopics.length;
      for (const t of resultTopics) {
        // TODO: this is a code smell.
        // Currently we're using a quirk of the API code, that the first poster in the summary
        // is always the original poster. The only other way to tell is by parsing it from the
        // translated human description.
        // See: https://github.com/discourse/discourse/blob/23367e79ea735598766ec6f507f6132e0bad3dba/lib/topic_query.rb#L443
        const opUsername = usernamesById.get(t.posters[0].user_id);
        if (opUsername == null) {
          throw new Error(
            `Unexpected missing OP user for ${stringify(
              t.posters[0]
            )} in map ${stringify(Array.from(usernamesById.entries()))}`
          );
        }
        const topic: Topic = {
          id: t.id,
          categoryId: t.category_id,
          title: t.title,
          timestampMs: Date.parse(t.created_at),
          bumpedMs: t.bumped_at ? Date.parse(t.bumped_at) : null,
          authorUsername: opUsername,
        };

        if (topic.bumpedMs == null) {
          throw new Error(
            "Unexpected missing bumped_at field for /latest.json request."
          );
        }

        if (topic.bumpedMs > sinceMs) {
          topics.push(topic);
        } else if (!t.pinned) {
          pastSince = true;
        }
      }
      page++;
    }

    return topics;
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
    const {posts_count: postCount} = json;
    let posts = json.post_stream.posts.map(parsePost);
    const topic: Topic = {
      id: json.id,
      categoryId: json.category_id,
      title: json.title,
      timestampMs: Date.parse(json.created_at),
      bumpedMs: json.bumped_at
        ? Date.parse(json.bumped_at)
        : Date.parse(json.created_at),
      authorUsername: json.details.created_by.username,
    };

    // TODO: wondering if this could cause infinite loops in case the API is weird.
    // Perhaps short-circuit it when a page returns 0 posts.
    // Pagination here is 1-based.
    let page = 1;
    while (postCount > posts.length) {
      page++;
      const resNext = await this._fetch(`/t/${id}.json?page=${page}`);
      failForNotOk(resNext);
      const subPosts = (await resNext.json()).post_stream.posts.map(parsePost);
      posts = [...posts, ...subPosts];
    }

    return {topic, posts};
  }

  async likesByUser(username: string, offset: number): Promise<LikeAction[]> {
    const response = await this._fetch(
      `/user_actions.json?username=${username}&filter=1&offset=${offset}`
    );
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
