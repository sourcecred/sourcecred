// @flow

import type {Topic, Post, CategoryId, TopicId} from "../discourse/fetch";
import type {Initiative, URL, InitiativeRepository} from "./initiative";
import {
  parseCookedHtml,
  type HtmlTemplateInitiativePartial,
} from "./htmlTemplate";
import {topicAddress} from "../discourse/address";

/**
 * A subset of queries we need for our plugin.
 */
export interface DiscourseQueries {
  /**
   * Finds the TopicIds of topics that have one of the categoryIds as it's category.
   */
  topicsInCategories(
    categoryIds: $ReadOnlyArray<CategoryId>
  ): $ReadOnlyArray<TopicId>;

  /**
   * Gets a Topic by ID.
   */
  topicById(id: TopicId): ?Topic;

  /**
   * Gets a number of Posts in a given Topic.
   */
  postsInTopic(topicId: TopicId, numberOfPosts: number): $ReadOnlyArray<Post>;
}

type DiscourseInitiativeRepositoryOptions = {|
  +serverUrl: string,
  +queries: DiscourseQueries,
  +initiativesCategory: CategoryId,
  +topicBlacklist: $ReadOnlyArray<TopicId>,
  +parseCookedHtml?: (cookedHTML: string) => HtmlTemplateInitiativePartial,
|};

/**
 * Repository to get Initiatives from Discourse data.
 *
 * Note: will warn about parsing errors and only return Initiatives that could
 * be parsed successfully.
 */
export class DiscourseInitiativeRepository implements InitiativeRepository {
  _options: DiscourseInitiativeRepositoryOptions;

  constructor(options: DiscourseInitiativeRepositoryOptions) {
    this._options = options;
  }

  initiatives(): $ReadOnlyArray<Initiative> {
    const {
      serverUrl,
      queries,
      initiativesCategory,
      topicBlacklist,
    } = this._options;
    const parser = this._options.parseCookedHtml || parseCookedHtml;

    // Gets a list of TopicIds by category, and remove the blacklisted ones.
    const topicIds = new Set(queries.topicsInCategories([initiativesCategory]));
    for (const tid of topicBlacklist) {
      topicIds.delete(tid);
    }

    const initiatives = [];
    const errors = [];
    const expected = topicIds.size;
    for (const tid of topicIds) {
      const topic = queries.topicById(tid);
      const [openingPost] = queries.postsInTopic(tid, 1);

      if (!topic || !openingPost) {
        throw new Error("Implementation bug, should have topic and op here.");
      }

      // We're using parse errors only for informative purposes.
      // Trap them here and push to errors list.
      try {
        initiatives.push(
          initiativeFromDiscourseTracker(serverUrl, topic, openingPost, parser)
        );
      } catch (e) {
        errors.push(e.message);
      }
    }

    // Warn about the issues we've encountered in one go.
    if (errors.length > 0) {
      console.warn(
        `Failed loading [${
          errors.length
        }/${expected}] initiatives:\n${errors.join("\n")}`
      );
    }

    return initiatives;
  }
}

/**
 * Uses data from a Discourse Topic to create an Initiative representation.
 *
 * The Post should be the opening post of the Topic.
 * The Post body should adhere to the `parseCookedHtml` expected template.
 */
export function initiativeFromDiscourseTracker(
  serverUrl: string,
  topic: Topic,
  openingPost: Post,
  parseCookedHtml: (cookedHTML: string) => HtmlTemplateInitiativePartial
): Initiative {
  if (serverUrl.endsWith("/")) {
    throw new Error("serverUrl shouldn't end with trailing slash");
  }

  const {title} = topic;
  const {timestampMs} = openingPost;
  try {
    if (openingPost.topicId !== topic.id) {
      throw new Error(`Post ${openingPost.id} is from a different topic`);
    }

    if (openingPost.indexWithinTopic !== 1) {
      throw new Error(
        `Post ${openingPost.id} is not the first post in the topic`
      );
    }

    const tracker = topicAddress(serverUrl, topic.id);
    const partial = parseCookedHtml(openingPost.cooked);
    return {
      title,
      tracker,
      timestampMs,
      completed: partial.completed,
      dependencies: absoluteURLs(serverUrl, partial.dependencies),
      references: absoluteURLs(serverUrl, partial.references),
      contributions: absoluteURLs(serverUrl, partial.contributions),
      champions: absoluteURLs(serverUrl, partial.champions),
    };
  } catch (e) {
    // To make solving issues easier, add which initiative topic caused the problem.
    e.message = `${e.message} for initiative topic "${title}" ${topicUrl(
      serverUrl,
      topic.id
    )}`;
    throw e;
  }
}

/**
 * Helper function to create a topic URL.
 */
function topicUrl(serverUrl: string, topicId: TopicId) {
  // Note: this format doesn't include the "url-friendly-title" infix.
  // Favoring simplicity, this URL will redirect to include it while being valid.
  return `${serverUrl}/t/${topicId}`;
}

/**
 * Makes a best effort absolute URL.
 *
 * Only supports prefixing the serverUrl when the URL starts with a "/".
 * Other cases should fail later on, such as for reference detection.
 */
function absoluteURLs(
  serverUrl: string,
  urls: $ReadOnlyArray<URL>
): $ReadOnlyArray<URL> {
  return urls.map((url) => {
    if (url.startsWith("/")) {
      return `${serverUrl}${url}`;
    }

    return url;
  });
}
