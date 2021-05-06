// @flow

import {MemoryCacheProvider} from "./memoryCacheProvider";
import {type CacheProvider} from "./cache";

describe("src/backend/memoryCacheProvider", () => {
  describe("MemoryCacheProvider", () => {
    it("should be a CacheProvider", () => {
      const _ = (x: MemoryCacheProvider): CacheProvider => x;
    });

    describe("database", () => {
      it("should share the Database given the same id", async () => {
        // Given
        const idA = "alpha";
        const idB = "beta";

        // When
        const cache = new MemoryCacheProvider();
        const a1 = await cache.database(idA);
        const a2 = await cache.database(idA);
        const b1 = await cache.database(idB);
        const b2 = await cache.database(idB);

        // Then
        expect(a1).toBe(a2);
        expect(b1).toBe(b2);
        expect(a1).not.toBe(b1);
      });

      it("should not globally share Database given the same id", async () => {
        // Given
        const id = "alpha";

        // When
        const cache1 = new MemoryCacheProvider();
        const cache2 = new MemoryCacheProvider();
        const a1 = await cache1.database(id);
        const a2 = await cache2.database(id);

        // Then
        expect(a1).not.toBe(a2);
      });
    });
  });
});
