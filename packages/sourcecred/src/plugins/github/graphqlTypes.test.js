// @flow

import fs from "fs-extra";
import path from "path";

import generateGithubGraphqlFlowTypes from "./generateGraphqlFlowTypes";

describe("plugins/github/graphqlTypes", () => {
  it("is up to date", async () => {
    const typesFilename = path.join(__dirname, "graphqlTypes.js");
    const actual = (await fs.readFile(typesFilename)).toString();
    const expected = generateGithubGraphqlFlowTypes();
    // If this fails, run `yarn build:backend` and then invoke
    //      node ./bin/generateGithubGraphqlFlowTypes.js
    // saving the output to the types file listed above.
    expect(actual).toEqual(expected);
  });
});
