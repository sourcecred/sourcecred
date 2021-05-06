// @flow

import {githubOwnerPattern, githubRepoPattern} from "./repoId";
const urlBase = "^https?://github\\.com";
const repoUrl = `${urlBase}/(?:${githubOwnerPattern})/(?:${githubRepoPattern})/`;

export function reviewUrlToId(url: string): string {
  const suffix = /pull\/\d+#pullrequestreview-(\d+)$/;
  const regex = new RegExp(repoUrl + suffix.source);
  const result = regex.exec(url);
  if (result == null) {
    throw new Error(`Error parsing review url ${url}`);
  }
  return result[1];
}

export function issueCommentUrlToId(url: string): string {
  const suffix = /issues\/\d+#issuecomment-(\d+)$/;
  const regex = new RegExp(repoUrl + suffix.source);
  const result = regex.exec(url);
  if (result == null) {
    throw new Error(`Error parsing issue comment url ${url}`);
  }
  return result[1];
}

export function pullCommentUrlToId(url: string): string {
  const suffix = /pull\/\d+#issuecomment-(\d+)$/;
  const regex = new RegExp(repoUrl + suffix.source);
  const result = regex.exec(url);
  if (result == null) {
    throw new Error(`Error parsing pull comment url ${url}`);
  }
  return result[1];
}

export function reviewCommentUrlToId(url: string): string {
  const suffix = /pull\/\d+#discussion_r(\d+)/;
  const regex = new RegExp(repoUrl + suffix.source);
  const result = regex.exec(url);
  if (result == null) {
    throw new Error(`Error parsing review comment url ${url}`);
  }
  return result[1];
}
