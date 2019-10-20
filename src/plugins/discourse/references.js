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
export function parseLinks(cookedHtml: string): UrlString[] {
  const links = [];
  const httpRegex = /^https?:\/\//;
  const parser = new htmlparser2.Parser({
    onopentag(name, attribs) {
      if (name === "a") {
        const href = attribs.href;
        if (href != null) {
          if (href.match(httpRegex)) {
            links.push(href);
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
  const server = "(https://[\\w.-]+)";
  const topic = `(?:${server})/t/[\\w-]+/(\\d+)`;
  const post = `(?:${topic})/(\\d+)`;
  const params = "(?:\\?[\\w-=]+)?";

  const topicRegex = new RegExp(`^(?:${topic})(?:${params})/?$`);
  const postRegex = new RegExp(`^(?:${post})(?:${params})/?$`);
  const userRegex = new RegExp(`^(?:${server})/u/([\\w-]+)(?:${params})/?$`);
  const references: DiscourseReference[] = [];
  for (const link of links) {
    let match = null;
    const decoded = decodeURI(link);
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
