// @flow

import {exampleEntities} from "./example/example";
import {createdAt} from "./createdAt";

describe("plugins/github/createdAt", () => {
  it("provides timestamps", () => {
    const results = {};
    const examples = exampleEntities();
    for (const name of Object.keys(examples)) {
      const entity = examples[name];
      results[name] = createdAt(entity);
    }
    expect(results).toMatchInlineSnapshot(`
Object {
  "comment": 1519878210000,
  "commit": null,
  "issue": 1519807129000,
  "pull": 1519807636000,
  "repo": null,
  "review": 1519878210000,
  "userlike": null,
}
`);
  });
});
