// @flow

import schema from "./schema";

describe("plugins/github/schema", () => {
  describe("schema", () => {
    it("creates a valid schema", () => {
      expect(schema()).toEqual(expect.anything());
    });
  });
});
