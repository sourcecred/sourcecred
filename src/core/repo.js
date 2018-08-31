// @flow

export opaque type Repo: {|+name: string, +owner: string|} = {|
  +name: string,
  +owner: string,
|};

export const githubOwnerPattern = "[A-Za-z0-9-]+";
export const githubRepoPattern = "[A-Za-z0-9-._]+";

export function makeRepo(owner: string, name: string): Repo {
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

export function stringToRepo(x: string): Repo {
  const pieces = x.split("/");
  if (pieces.length !== 2) {
    throw new Error(`Invalid repo string: ${x}`);
  }
  return makeRepo(pieces[0], pieces[1]);
}

export function repoToString(x: Repo): string {
  return `${x.owner}/${x.name}`;
}
