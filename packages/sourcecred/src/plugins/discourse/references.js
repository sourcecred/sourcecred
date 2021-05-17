// @flow

const htmlparser2 = require("htmlparser2");

import {type TopicId} from "./fetch";

export type DiscoursePostReference = {|
  +type: "POST",
  +topicId: TopicId,
  +postIndex: number,
  +serverUrl: string,
|};

export type DiscourseTopicReference = {|
  +type: "TOPIC",
  +topicId: TopicId,
  +serverUrl: string,
|};

export type DiscourseUserReference = {|
  +type: "USER",
  +username: string,
  +serverUrl: string,
|};

export type DiscourseReference =
  | DiscoursePostReference
  | DiscourseTopicReference
  | DiscourseUserReference;

export type UrlString = string;
/**
 * Parse the links from a Discourse post's cookedHtml, generating
 * an array of UrlStrings. All of the UrlStrings will contain the full
 * server URL (i.e. relative references are made absolute). The serverUrl
 * is required so that we can do this.
 */
export function parseLinks(cookedHtml: string, serverUrl: string): UrlString[] {
  const links = [];
  const httpRegex = /^https?:\/\//;
  if (serverUrl[serverUrl.length - 1] === "/") {
    // Strip trailing slash if it was provided, so we can concatenate
    // strings below.
    serverUrl = serverUrl.slice(0, serverUrl.length - 1);
  }
  if (!serverUrl.match(httpRegex)) {
    throw new Error(`Invalid server url ${serverUrl}`);
  }
  const parser = new htmlparser2.Parser({
    onopentag(name, attribs) {
      if (name === "a") {
        const href = attribs.href;
        if (href != null) {
          if (href.match(httpRegex)) {
            links.push(href);
          }
          if (href[0] === "/") {
            links.push(serverUrl + href);
          }
        }
      }
    },
  });
  parser.write(cookedHtml);
  parser.end();
  return links;
}

export function linksToReferences(
  links: $ReadOnlyArray<UrlString>
): DiscourseReference[] {
  const server = "(https?://[\\w.-]+)";
  const topic = `(?:${server})/t/[\\w-]+/(\\d+)`;
  const post = `(?:${topic})/(\\d+)`;
  const params = "(?:\\?[\\w-=]+)?";

  const topicRegex = new RegExp(`^(?:${topic})(?:${params})/?$`);
  const postRegex = new RegExp(`^(?:${post})(?:${params})/?$`);
  const userRegex = new RegExp(`^(?:${server})/u/([\\w-]+)(?:${params})/?$`);
  const references: DiscourseReference[] = [];
  for (const link of links) {
    let match = null;
    let decoded;
    try {
      decoded = decodeURI(link);
    } catch (e) {
      console.error(`${e}\nFor URL: ${link}`);
      continue;
    }
    if ((match = decoded.match(postRegex))) {
      references.push({
        type: "POST",
        topicId: +match[2],
        serverUrl: match[1],
        postIndex: +match[3],
      });
    } else if ((match = decoded.match(topicRegex))) {
      references.push({type: "TOPIC", topicId: +match[2], serverUrl: match[1]});
    } else if ((match = decoded.match(userRegex))) {
      references.push({
        type: "USER",
        username: match[2],
        serverUrl: match[1],
      });
    }
  }
  return references;
}
