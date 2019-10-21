// @flow

import {DomHandler, DomUtils, Parser} from "htmlparser2";

import {type Topic, type Post} from "../discourse/fetch";
import {type Initiative, type URL} from "./initiative";
import {topicAddress} from "../discourse/address";

type HeaderToURLsMap = Map<string, $ReadOnlyArray<URL>>;

export async function initiativeFromDiscourseTracker(
  serverUrl: string,
  topic: Topic,
  firstPost: Post
): Promise<Initiative> {
  if (firstPost.topicId !== topic.id) {
    throw new Error("Post is from a different topic");
  }

  if (firstPost.indexWithinTopic !== 1) {
    throw new Error("Post is not the first post in the topic");
  }

  const {title} = topic;
  const {timestampMs} = firstPost;
  const tracker = topicAddress(serverUrl, topic.id);

  const htu: HeaderToURLsMap = await groupURLsByHeader(firstPost.cooked);
  const completed = findCompletionStatus(htu);
  const champions = singleMatch(htu, new RegExp(/^Champions?/i));
  const contributions = singleMatch(htu, new RegExp(/^Contributions?/i));
  const dependencies = singleMatch(htu, new RegExp(/^Dependenc(y|ies)/i));
  const references = singleMatch(htu, new RegExp(/^References?/i));

  const missing = [];
  if (completed === null) missing.push("status");
  if (!champions) missing.push("champions");
  if (!contributions) missing.push("contributions");
  if (!dependencies) missing.push("dependencies");
  if (!references) missing.push("references");

  if (
    completed == null ||
    champions == null ||
    contributions == null ||
    dependencies == null ||
    references == null
  ) {
    missing.sort();
    const missingStr = JSON.stringify(missing);
    throw new Error(
      `Missing or malformed headers ${missingStr} for initiative topic "${title}" (${topic.id})`
    );
  }

  return {
    title,
    tracker,
    timestampMs,
    completed,
    champions,
    contributions,
    dependencies,
    references,
  };
}

function findCompletionStatus(map: HeaderToURLsMap): boolean | null {
  const pattern = new RegExp(/^Status:(.*)/i);
  const headers = Array.from(map.keys())
    .map((k) => k.trim())
    .filter((k) => pattern.test(k));

  if (headers.length !== 1) {
    return null;
  }

  const matches = headers[0].match(pattern);
  if (matches == null) {
    return null;
  }

  const completedRE = new RegExp(/^completed?$/i);
  return completedRE.test(matches[1].trim());
}

function singleMatch(
  map: HeaderToURLsMap,
  pattern: RegExp
): $ReadOnlyArray<URL> | null {
  const headers = Array.from(map.keys()).filter((k) => pattern.test(k.trim()));

  if (headers.length !== 1) {
    return null;
  }

  return map.get(headers[0]) || null;
}

export async function groupURLsByHeader(
  cookedHTML: string
): Promise<HeaderToURLsMap> {
  const map: HeaderToURLsMap = new Map();
  const dom = await promiseDOM(cookedHTML);

  let currentHeader: string | null = null;
  for (const rootEl of dom) {
    switch (rootEl.name) {
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6":
        currentHeader = DomUtils.getText(rootEl);
        // We're also interested in just headers, so make sure an entry exists.
        map.set(currentHeader, []);
        break;
      case "p":
      case "ul":
      case "ol":
        if (currentHeader === null) break;
        const existing = map.get(currentHeader) || [];
        const anchors = DomUtils.findAll((el) => el.name === "a", [rootEl]).map(
          (a) => a.attribs.href
        );
        map.set(currentHeader, [...existing, ...anchors]);
        break;
    }
  }

  return map;
}

function promiseDOM(cookedHTML: string): Promise<Object> {
  return new Promise((res, rej) => {
    const domHandler = new DomHandler((err, dom) => {
      if (err) rej(err);
      res(dom);
    });
    const htmlParser = new Parser(domHandler);
    htmlParser.write(cookedHTML);
    htmlParser.end();
  });
}
