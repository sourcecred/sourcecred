// @flow

import {type Project} from "../../core/project";

export function urlToProjectId(url: string): string {
  return url.trim().replace(/^https?:\/\//, "");
}

/**
 * Convert a string discourse server URL into a project.
 */
export function urlsToProject(serverUrls: string[]): Project {
  const projectId = serverUrls.length > 1 ? "multiple" : serverUrls[0];

  return {
    id: urlToProjectId(projectId),
    repoIds: [],
    discourseServers: serverUrls.map((serverUrl) => ({serverUrl})),
    identities: [],
  };
}
