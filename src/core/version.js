// @flow

import deepFreeze from "deep-freeze";
export type VersionInfo = {|
  +major: number,
  +minor: number,
  +patch: number,
  +gitState: GitState,
  +environment: Environment,
|};
export type GitState = {|
  +commitHash: string,
  +commitTimestamp: string, // YYYYmmdd-HHMM, in commit-local time
  +dirty: boolean, // does the worktree have unstaged/uncommitted changes?
|};
export type Environment = "development" | "production" | "test";

/**
 * Parse the given string as a `GitState`, throwing an error if it is
 * not valid. The argument should be the result of calling
 * `JSON.stringify` with a valid `GitState`. Thus, this is a checked
 * version of `JSON.parse`.
 */
export function parseGitState(raw: ?string): GitState {
  if (typeof raw !== "string") {
    throw new Error("gitState: not a string: " + String(raw));
  }
  const parsed: mixed = JSON.parse(raw);
  if (parsed == null || typeof parsed !== "object") {
    throw new Error("gitState: not a JSON object: " + String(parsed));
  }
  deepFreeze(parsed);
  // This intermediate variable helps out Flow's inference...
  const gitState: Object = parsed;
  if (
    typeof gitState.commitHash !== "string" ||
    typeof gitState.commitTimestamp !== "string" ||
    typeof gitState.dirty !== "boolean" ||
    Object.keys(gitState).length !== 3
  ) {
    throw new Error("gitState: bad shape: " + JSON.stringify(gitState));
  }
  return gitState;
}
const gitState = parseGitState(process.env.SOURCECRED_GIT_STATE);

/**
 * Parse the given string as an `Environment`, throwing an error if it
 * is not valid. The input should be a valid `Environment`.
 */
export function parseEnvironment(raw: ?string): Environment {
  if (raw !== "development" && raw !== "production" && raw !== "test") {
    throw new Error(
      "environment: " + (raw == null ? String(raw) : JSON.stringify(raw))
    );
  }
  return raw;
}
const environment = parseEnvironment(process.env.NODE_ENV);

export const VERSION_INFO: VersionInfo = deepFreeze({
  major: 0,
  minor: 4,
  patch: 0,
  gitState,
  environment,
});

export function formatShort(info: VersionInfo): string {
  return `v${info.major}.${info.minor}.${info.patch}`;
}

export function formatFull(info: VersionInfo): string {
  const parts = [
    `v${info.major}.${info.minor}.${info.patch}`,
    info.gitState.commitHash,
    info.gitState.commitTimestamp,
    info.gitState.dirty ? "dirty" : "clean",
    info.environment,
  ];
  return parts.join("-");
}

export const VERSION_SHORT: string = formatShort(VERSION_INFO);
export const VERSION_FULL: string = formatFull(VERSION_INFO);
