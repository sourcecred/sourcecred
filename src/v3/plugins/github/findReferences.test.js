// @flow

import {findReferences} from "./findReferences.js";

import * as R from "./relationalView";

describe("plugins/github/findReferences", () => {
  it("matches snapshot on exmaple-github data", () => {
    const data = require("./demoData/example-github");
    const view = new R.RelationalView(data);
    const references = Array.from(findReferences(view));
    expect(references).toMatchSnapshot();
  });
});
