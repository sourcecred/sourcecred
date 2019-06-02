// @flow

import {exampleEntities} from "./example/example";
import {description} from "./description";

describe("plugins/github/description", () => {
  const examples = exampleEntities();
  for (const name of Object.keys(examples)) {
    it(`renders the right description for a ${name}`, () => {
      const entity = examples[name];
      expect(description(entity)).toMatchSnapshot();
    });
  }
});
