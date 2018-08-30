// @flow

// TODO(#638): Allow projects to specify bots via configuration,
// rather than depending on this single souce of truth
export function botSet(): Set<string> {
  return new Set([
    "codecov",
    "credbot",
    "facebook-github-bot",
    "gitcoinbot",
    "googlebot",
    "greenkeeper",
    "greenkeeperio-bot",
    "metamaskbot",
    "nodejs-github-bot",
    "stickler-ci",
    "tensorflow-jenkins",
    "tensorflowbutler",
  ]);
}
