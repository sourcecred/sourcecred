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

import fetch from "isomorphic-fetch";
import Bottleneck from "bottleneck";
import * as NullUtil from "../../util/null";
import {type TimestampMs} from "../../util/timestamp";

export type UserId = number;
export type PostId = number;
export type TopicId = number;
export type CategoryId = number;
export type Tag = string;

/**
 * The "view" received from the Discourse API
 * when getting a topic by ID.
 *
 * This filters some relevant data like bumpedMs,
 * and the type separation makes this distinction clear.
 */
export type TopicView = {|
  +id: TopicId,
  +categoryId: CategoryId,
  +tags: $ReadOnlyArray<Tag>,
  +title: string,
  +timestampMs: TimestampMs,
  +authorUsername: string,
|};

/**
 * The "latest" format Topic from the Discourse API
 * when getting a list of sorted topics.
 *
 * This filters relevant data like authorUsername,
 * and the type separation makes this distinction clear.
 */
export type TopicLatest = {|
  +id: TopicId,
  +categoryId: CategoryId,
  +tags: $ReadOnlyArray<Tag>,
  +title: string,
  +timestampMs: TimestampMs,
  +bumpedMs: number,
|};

/**
 * A complete Topic object.
 */
export type Topic = {|
  ...TopicView,
  ...TopicLatest,
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
  +timestampMs: TimestampMs,
  // the Discourse trust level of the author of the post
  +trustLevel: number,
  +authorUsername: string,
  // The post HTML for rendering.
  +cooked: string,
|};

export type TopicWithPosts = {|
  +topic: TopicView,
  // Guaranteed to contain all the Posts in the topic.
  +posts: $ReadOnlyArray<Post>,
|};

export type User = {|
  +username: string,
  +trustLevel: number | null,
|};

export type LikeAction = {|
  // The user who liked something
  +username: string,
  // The post being liked
  +postId: PostId,
  +timestampMs: TimestampMs,
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
   * May be 404 on the server, which will return a null here.
   */
  likesByUser(
    targetUsername: string,
    offset: number
  ): Promise<LikeAction[] | null>;

  // Retrieves the User data for a specific username.
  getUserData(username: string): Promise<User | null>;

  // Gets the topic IDs for every "about-x-category" topic.
  // Discourse calls this a "definition" topic.
  categoryDefinitionTopicIds(): Promise<Set<TopicId>>;

  /**
   * Fetches Topics that have been bumped to a higher timestamp than `sinceMs`.
   *
   * Note: this will not be able to find "about-x-category" category definition topics.
   * due to a hard-coded filter in the API.
   * https://github.com/discourse/discourse/blob/594925b8965a26c512665371092fec3383320b58/app/controllers/list_controller.rb#L66
   *
   * Use categoryDefinitionTopicIds() to find those topics.
   */
  topicsBumpedSince(sinceMs: number): Promise<TopicLatest[]>;
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

  async _fetchWithRetryOn520(
    fullUrl: string,
    fetchOptions: RequestOptions
  ): Promise<Response> {
    // We've started sporadically seeing 520 errors when hitting Discourse API
    // endpoints. It's generally while fetching topics, but is always a
    // different topic, so I think it's a rare/ephemeral bug on the Discourse
    // side.
    // We can just retry a few times if we get a 520 and it's unlikely to fail
    // 3 times in a row.
    // See https://github.com/sourcecred/sourcecred/issues/2491
    let tries = 3;
    while (tries > 0) {
      tries--;
      const response = await this._fetchImplementation(fullUrl, fetchOptions);
      if (response.status !== 520) {
        return response;
      }
    }
    throw new Error(`repeated 520 errors on ${fullUrl}`);
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
    return this._fetchWithRetryOn520(fullUrl, fetchOptions);
  }

  async categoryDefinitionTopicIds(): Promise<Set<TopicId>> {
    const topicIdRE = new RegExp("/t/[\\w-]+/(\\d+)$");
    const urls: string[] = [];
    const categoriesWithSubcategories: CategoryId[] = [];

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
        categoriesWithSubcategories.push(cat.id);
      }
    }

    // Subcategories
    for (const rootCatId of categoriesWithSubcategories) {
      const subResponse = await this._fetch(
        `/categories.json?show_subcategory_list=true&parent_category_id=${rootCatId}`
      );
      failIfMissing(subResponse);
      failForNotOk(subResponse);
      const {categories: subCategories} = (
        await subResponse.json()
      ).category_list;
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

    return new Set(ids);
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
    // Tags might be `undefined` if tags were disabled on the server.
    // If so, set tags to an empty array.
    const tags = json.tags || [];
    const topic: TopicView = {
      id: json.id,
      categoryId: json.category_id,
      title: json.title,
      tags,
      timestampMs: Date.parse(json.created_at),
      authorUsername: json.details.created_by.username,
    };

    // This shouldn't could cause infinite loops when the API is weird.
    // As requesting pages beyond the last page will produce a 404.
    // Pagination here is 1-based, and we already had page 1.
    let page = 2;
    while (postCount > posts.length) {
      const resNext = await this._fetch(`/t/${id}.json?page=${page}`);
      failForNotOk(resNext);
      const subPosts = (await resNext.json()).post_stream.posts.map(parsePost);
      posts = [...posts, ...subPosts];
      page++;
    }

    return {topic, posts};
  }

  async getUserData(username: string): Promise<User | null> {
    const response = await this._fetch(`/users/${username}.json`);

    if (response.status === 404) {
      // The user probably no longer exists. This is expected, see #1440.
      return null;
    }

    failIfMissing(response);
    failForNotOk(response);

    const json = await response.json();

    return parseUser(json.user);
  }

  async likesByUser(
    targetUsername: string,
    offset: number
  ): Promise<LikeAction[] | null> {
    const response = await this._fetch(
      `/user_actions.json?username=${targetUsername}&filter=1&offset=${offset}`
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

  async topicsBumpedSince(sinceMs: number): Promise<TopicLatest[]> {
    const topics: TopicLatest[] = [];
    let lastUnpinnedTimestamp: number = Infinity;
    let morePages: boolean = true;
    let page: number = 0;

    // Keep going till we've found timestamps older than sinceMs.
    while (lastUnpinnedTimestamp >= sinceMs && morePages) {
      const response = await this._fetch(
        `/latest.json?order=activity&ascending=false&page=${page}`
      );
      failIfMissing(response);
      failForNotOk(response);
      const {topic_list: topicList} = await response.json();

      // Having the same amount of results as expected by pagination, assume there's another page.
      morePages = topicList.per_page === topicList.topics.length;

      for (const jsonTopic of topicList.topics) {
        const topic = parseLatestTopic(jsonTopic);

        // Due to how pinning works, we may have some topics in here that weren't bumped past `sinceMs`.
        // Filter those out now.
        if (topic.bumpedMs > sinceMs) {
          topics.push(topic);
        }

        // Make sure we ignore pinned topics for this value, as pinned topics move to the top,
        // and are unhelpful in knowing whether we should fetch another page.
        if (!jsonTopic.pinned) {
          lastUnpinnedTimestamp = Math.min(
            lastUnpinnedTimestamp,
            topic.bumpedMs
          );
        }
      }

      page++;
    }

    return topics;
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

/**
 * Parses a "latest" topic.
 *
 * A "latest" topic, is a topic as returned by the /latest.json API call,
 * and has a distinct assumptions:
 * - bumped_at is always present.
 *
 * usernamesById map used to resolve these IDs to usernames.
 */
function parseLatestTopic(json: any): TopicLatest {
  if (json.bumped_at == null) {
    throw new Error(
      `Unexpected missing bumped_at field for /latest.json request for topic ID ${json.id}.`
    );
  }

  return {
    id: json.id,
    categoryId: json.category_id,
    tags: json.tags,
    title: json.title,
    timestampMs: Date.parse(json.created_at),
    bumpedMs: Date.parse(json.bumped_at),
  };
}

function parsePost(json: any): Post {
  return {
    id: json.id,
    timestampMs: Date.parse(json.created_at),
    indexWithinTopic: json.post_number,
    replyToPostIndex: json.reply_to_post_number,
    topicId: json.topic_id,
    trustLevel: json.trust_level,
    authorUsername: json.username,
    cooked: json.cooked,
  };
}

function parseUser(json: any): User {
  return {
    username: json.username,
    trustLevel: json.trust_level,
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
