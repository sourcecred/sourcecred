// @flow

// Right now all RepoIds are assumed to refer to GitHub repos.
// In the future, we may support other identifiers.
export opaque type RepoId: {|
  +name: string,
  +owner: string,
|} = {|
  +name: string,
  +owner: string,
|};

export type RepoIdString = string;

export const githubOwnerPattern = "[A-Za-z0-9-]+";
export const githubRepoPattern = "[A-Za-z0-9-._]+";

export function makeRepoId(owner: string, name: string): RepoId {
  const validOwner = new RegExp(`^${githubOwnerPattern}$`);
  const validRepo = new RegExp(`^${githubRepoPattern}$`);
  if (!owner.match(validOwner)) {
    throw new Error(`Invalid repository owner: ${JSON.stringify(owner)}`);
  }
  if (!name.match(validRepo)) {
    throw new Error(`Invalid repository name: ${JSON.stringify(name)}`);
  }
  return {owner, name};
}

export function stringToRepoId(x: string): RepoId {
  const pieces = x.split("/");
  if (pieces.length !== 2) {
    throw new Error(`Invalid repo string: ${x}`);
  }
  return makeRepoId(pieces[0], pieces[1]);
}

export function repoIdToString(x: RepoId): RepoIdString {
  return `${x.owner}/${x.name}`;
}
