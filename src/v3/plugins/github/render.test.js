// @flow

import {exampleEntities} from "./example/example";
import {description} from "./render";

describe("plugins/github/render", () => {
  it("descriptions are as expected", () => {
    const examples = exampleEntities();
    const withDescriptions = {};
    for (const name of Object.keys(exampleEntities())) {
      const entity = examples[name];
      withDescriptions[name] = description(entity);
    }
    expect(withDescriptions).toMatchSnapshot();
  });
});
