// @flow

import {findReferences} from "./findReferences.js";

import {EntityStore} from "./entityStore";
import type {GithubResponseJSON} from "./graphql";
import {addressify} from "./addressify";

describe("plugins/github/findReferences", () => {
  it("matches snapshot on exmaple-github data", () => {
    const data: GithubResponseJSON = require("./demoData/example-github");
    const store = new EntityStore(addressify(data));
    const references = Array.from(findReferences(store));
    expect(references).toMatchSnapshot();
  });
});
