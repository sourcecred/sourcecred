// @flow

function findAllMatches(re: RegExp, s: string): any[] {
  // modified from: https://stackoverflow.com/a/6323598
  let m;
  const matches = [];
  do {
    m = re.exec(s);
    if (m) {
      matches.push(m);
    }
  } while (m);
  return matches;
}

export function findNumericReferences(body: string): number[] {
  return findAllMatches(/(?:\W|^)#(\d+)(?:\W|$)/g, body).map((x) => +x[1]);
}

export type GithubUrlMatch = {|
  +repoName: string,
  +repoOwner: string,
  +parentType: "pull" | "issues",
  +number: number,
  +commentFragment: ?{|
    +fragmentType:
      | "issue" // a directly linked issue or pull request
      | "issuecomment" // a directly linked regular comment on issue or pull request
      | "pullrequestreview" // a pull request review
      | "discussion_r", // a review comment as part of a pull request review
    +fragmentNumber: number,
  |},
|};

export function findGithubUrlReferences(body: string): GithubUrlMatch[] {
  const githubNamePart = /([a-zA-Z0-9_-]+)/.source;
  const urlRegex = new RegExp(
    "" +
      /(?:\W|^)http(?:s)?:\/\/github.com\//.source +
      githubNamePart +
      /\//.source +
      githubNamePart +
      /\/(issues|pull)\//.source +
      /(\d+)/.source +
      /(#(issue|issuecomment|pullrequestreview|discussion_r)-?(\d+))?/.source +
      /(?:\W|$)/.source,
    "gm"
  );
  return findAllMatches(urlRegex, body).map((match) => {
    let commentFragment: $ElementType<GithubUrlMatch, "commentFragment">;
    if (match[5] != null) {
      // we found a comment fragment
      commentFragment = {fragmentType: match[6], fragmentNumber: +match[7]};
    } else {
      commentFragment = null;
    }
    return {
      repoOwner: match[1],
      repoName: match[2],
      parentType: match[3],
      number: +match[4],
      commentFragment,
    };
  });
}
