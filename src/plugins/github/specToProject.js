// @flow

import {type Project, createProject} from "../../core/project";
import {
  stringToRepoId,
  githubOwnerPattern,
  githubRepoPattern,
} from "../../core/repoId";
import {fetchGithubOrg} from "./fetchGithubOrg";

/**
 * Convert a string repository spec into a project.
 *
 * The spec may take one of two forms:
 * - $REPO_OWNER/$REPO_NAME, as in 'sourcecred-test/example-github'
 * - @$REPO_OWNER, as in '@sourcecred'
 *
 * In either case, we will create a project with the spec as its
 * id. In the first construction, the project will have a single
 * RepoId, matching the spec string. In the second construction,
 * the project will have a RepoId for every repository owned by that
 * owner.
 *
 * A valid GitHub token must be provided, so that it's possible to
 * enumerate the repos for an org.
 */
export async function specToProject(
  spec: string,
  token: string
): Promise<Project> {
  const repoSpecMatcher = new RegExp(
    `^${githubOwnerPattern}/${githubRepoPattern}$`
  );
  const ownerSpecMatcher = new RegExp(`^@${githubOwnerPattern}$`);
  if (spec.match(repoSpecMatcher)) {
    const project: Project = createProject({
      id: spec,
      repoIds: [stringToRepoId(spec)],
    });
    return project;
  } else if (spec.match(ownerSpecMatcher)) {
    const owner = spec.slice(1);
    const org = await fetchGithubOrg(owner, token);
    const project: Project = createProject({
      id: spec,
      repoIds: org.repos,
    });
    return project;
  }
  throw new Error(`invalid spec: ${spec}`);
}
