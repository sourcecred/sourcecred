// @flow
import {selectUpdates} from "./update";

describe("cli/update", () => {
  describe("selectUpdates", () => {
    const f1 = async () => {};
    const f2 = async () => {};
    const f3 = async () => {};
    const f4 = async () => {};

    const u1 = [[1, 2, 3], f1];
    const u2 = [[1, 2, 10], f2];
    const u3 = [[3, 2, 1], f3];
    const u4 = [[3, 2, 4], f4];
    const u = [u1, u2, u3, u4];

    it("works", () => {
      expect(selectUpdates(u, "0.0.0", "9.9.9")).toEqual(u);
      expect(selectUpdates(u, "1.2.3", "1.2.10")).toEqual([u2]);
      expect(selectUpdates(u, "1.2.4", "1.2.11")).toEqual([u2]);
      expect(selectUpdates(u, "1.2.3", "3.2.1")).toEqual([u2, u3]);
      expect(selectUpdates(u, null, null)).toEqual([u1, u2, u3, u4]);
      expect(selectUpdates(u, null, "1.2.11")).toEqual([u1, u2]);
      expect(selectUpdates(u, undefined, "1.2.11")).toEqual([u1, u2]);
      expect(selectUpdates(u, "1.2.3", null)).toEqual([u2, u3, u4]);
      expect(selectUpdates(u, "1.2.3", undefined)).toEqual([u2, u3, u4]);
      expect(() => selectUpdates(u, "3.2.1", "1.2.3")).toThrow();
    });
  });
});
