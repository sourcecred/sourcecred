// @flow

import {exampleGraph} from "./example/example";

describe("plugins/github/createGraph", () => {
  it("example graph matches snapshot", () => {
    expect(exampleGraph()).toMatchSnapshot();
  });
});
