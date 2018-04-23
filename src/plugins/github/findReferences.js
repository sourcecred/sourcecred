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

export function findReferences(body: string): string[] {
  // Note to maintainer: If it becomes necessary to encode references in a
  // richer format, consider implementing the type signature described in
  // https://github.com/sourcecred/sourcecred/pull/130#pullrequestreview-113849998
  return [
    ...findNumericReferences(body),
    ...findGithubUrlReferences(body),
    ...findUsernameReferences(body),
  ];
}

function findNumericReferences(body: string): string[] {
  return findAllMatches(/(?:\W|^)(#\d+)(?:\W|$)/g, body).map((x) => x[1]);
}

function findUsernameReferences(body: string): string[] {
  return findAllMatches(/(?:\W|^)(@[a-zA-Z0-9-]+)(?:\W|$)/g, body).map(
    (x) => x[1]
  );
}

function findGithubUrlReferences(body: string): string[] {
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
  return findAllMatches(urlRegex, body).map((match) => match[0].trim());
}
