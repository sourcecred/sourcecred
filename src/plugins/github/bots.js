// @flow

// TODO(#638): Allow projects to specify bots via configuration,
// rather than depending on this single souce of truth
export function botSet(): Set<string> {
  return new Set([
    "codecov",
    "codecov-io",
    "credbot",
    "facebook-github-bot",
    "gitcoinbot",
    "gitter-badger",
    "googlebot",
    "greenkeeper",
    "greenkeeperio-bot",
    "metamaskbot",
    "nodejs-github-bot",
    "stickler-ci",
    "tensorflow-gardener",
    "tensorflow-jenkins",
    "tensorflowbutler",
    "github-actions",
    "vercel",
    "transifex-integration",
    "dependabot",
  ]);
}
