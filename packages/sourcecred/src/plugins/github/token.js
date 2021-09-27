// @flow

export type GithubToken = string;

/**
 * Validates a token against know formatting.
 * Throws an error if it appears invalid.
 *
 * Personal access token
 * https://help.github.com/en/github/authenticating-to-github/creating-a-personal-access-token-for-the-command-line
 *
 * Installation access token
 * https://developer.github.com/v3/apps/#create-a-new-installation-token
 */
export function validateToken(token: string): GithubToken {
  const accessTokenRE = /^gh[pousr]_[A-Za-z0-9_]*$/;
  const oldAccessTokenRE = /^[A-Fa-f0-9]{40}$/;
  if (accessTokenRE.test(token) || oldAccessTokenRE.test(token)) {
    return token;
  }

  // We're currently being lenient with installation tokens, since we're not completely
  // sure on the exact format. We're only warning on unexpected values but leave it up
  // to the GitHub API to reject the token if it's actually invalid.
  const installationAccessTokenRE = /^(v\d+)\.([A-Za-z0-9_]+)$/;
  const matches = installationAccessTokenRE.exec(token);
  if (matches != null) {
    const [_, version, hexCode] = matches;

    if (version !== "v1") {
      console.warn(
        `Warning: GitHub installation access token has an unexpected version "${version}".`
      );
    }

    if (hexCode.length !== 40) {
      console.warn(
        `Warning: GitHub installation access token has an unexpected hexadecimal component ` +
          `length of ${hexCode.length}.`
      );
    }

    return token;
  }

  throw new Error(
    `The token supplied to $SOURCECRED_GITHUB_TOKEN doesn't match any format known to work.\n` +
      `Please verify the token "${token}" is correct, or report a bug if you think it should work.`
  );
}
