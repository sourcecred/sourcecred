// @flow

import * as GN from "./nodes";
import {description} from "./render";

describe("plugins/git/render", () => {
  const examples = {
    commit: (): GN.CommitAddress => ({
      type: GN.COMMIT_TYPE,
      hash: "3715ddfb8d4c4fd2a6f6af75488c82f84c92ec2f",
    }),
  };
  it("commit snapshots as expected", () => {
    expect(description(examples.commit())).toMatchSnapshot();
  });
});
