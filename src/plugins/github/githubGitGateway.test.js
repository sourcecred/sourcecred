// @flow

import {makeRepoId} from "./repoId";
import {GithubGitGateway} from "./githubGitGateway";

describe("src/plugins/github/githubGitGateway", () => {
  describe("commitUrl", () => {
    it("works for a simple example", () => {
      const repoId = makeRepoId("sourcecred", "example-github");
      const hash = "ec91adb718a6";
      const url = new GithubGitGateway().commitUrl(repoId, hash);
      expect(url).toMatchInlineSnapshot(
        `"https://github.com/sourcecred/example-github/commit/ec91adb718a6"`
      );
    });
  });
});
