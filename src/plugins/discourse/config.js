// @flow

import {type MirrorOptions} from "./mirror";

export type DiscourseConfig = {|
  +serverUrl: string,
  +mirrorOptions?: $Shape<MirrorOptions>,
|};

type JsonObject =
  | string
  | number
  | boolean
  | null
  | JsonObject[]
  | {[string]: JsonObject};

export function parseConfig(raw: JsonObject): DiscourseConfig {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("bad config: " + JSON.stringify(raw));
  }
  let mirrorOptions = undefined;
  const {serverUrl} = raw;
  if (typeof serverUrl !== "string") {
    throw new Error("serverUrl not string: " + JSON.stringify(serverUrl));
  }
  const httpRE = new RegExp(/^https?:\/\//);
  if (!httpRE.test(serverUrl)) {
    throw new Error(
      "expected server url to start with 'https://' or 'http://'"
    );
  }
  if (raw.mirrorOptions !== undefined) {
    const {mirrorOptions: rawMO} = raw;
    if (rawMO == null || typeof rawMO !== "object" || Array.isArray(rawMO)) {
      throw new Error("bad config: " + JSON.stringify(rawMO));
    }
    const {recheckCategoryDefinitionsAfterMs} = rawMO;
    let {recheckTopicsInCategories} = rawMO;

    if (!Array.isArray(recheckTopicsInCategories)) {
      throw new Error(
        "mirrorOptions.recheckTopicsInCategories must be array, got " +
          JSON.stringify(recheckTopicsInCategories)
      );
    }
    if (!recheckTopicsInCategories.every((x) => typeof x === "number")) {
      throw new Error(
        "mirrorOptions.recheckTopicsInCategories must all be numbers, got " +
          JSON.stringify(recheckTopicsInCategories)
      );
    }
    recheckTopicsInCategories = recheckTopicsInCategories.map((x) => Number(x));
    if (typeof recheckCategoryDefinitionsAfterMs !== "number") {
      throw new Error(
        "recheckCategoryDefinitionsAfterMs must be number, got " +
          JSON.stringify(recheckCategoryDefinitionsAfterMs)
      );
    }
    mirrorOptions = {
      recheckCategoryDefinitionsAfterMs,
      recheckTopicsInCategories,
    };
  }

  return {serverUrl, mirrorOptions};
}
