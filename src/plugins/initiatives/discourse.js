// @flow

import type {Topic, Post, TopicId} from "../discourse/fetch";
import type {Initiative, URL} from "./initiative";
import type {HtmlTemplateInitiativePartial} from "./htmlTemplate";
import {topicAddress} from "../discourse/address";

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
