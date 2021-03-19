// @flow

import {WritableZipStorage, ZipStorage} from "./zip";
import {WritableDataStorage} from "./index";
import {encode, decode} from "./textEncoding";
import {deflate} from "pako";

export class MapStorage implements WritableDataStorage {
  +_map: Map<string, Uint8Array>;

  // Hack to pass unexpected (non-Uint8Array) value types in for testing
  constructor(map: Map<string, any> = new Map()) {
    this._map = map;
  }

  async get(key: string): Promise<Uint8Array> {
    const result = this._map.get(key);
    if (result == null) {
      throw new Error("No Entry Found");
    }
    return result;
  }

  async set(key: string, value: Uint8Array): Promise<void> {
    this._map.set(key, value);
  }
}
function compareUint8Arrays(array1: Uint8Array, array2: Uint8Array) {
  array2.forEach((value, i) => {
    expect(value).toBe(array1[i]);
  });
  expect(array1.length).toEqual(array2.length);
}

describe("core/storage/zip", () => {
  const entries = [
    ["badTest", "hello"],
    ["test", encode("hello")],
    ["testagain", new Uint8Array([0xab, 0xcd])],
    ["emptyText", new Uint8Array([])],
  ];
  const deflatedEntries = entries.map(([k, v]) => [k, deflate(v)]);
  const getMapStorage = (entries = deflatedEntries) => {
    return new MapStorage(new Map(entries));
  };
  const getAssertions = (Storage) => {
    it("returns values successfully", async () => {
      expect.hasAssertions();
      const base = getMapStorage();
      const zip = new Storage(base);
      const result = await zip.get("badTest");
      compareUint8Arrays(result, encode("hello"));
      expect(decode(result)).toBe("hello");
    });
    it("returns deflated strings as Uint8Arrays", async () => {
      expect.hasAssertions();
      const base = getMapStorage();
      const zip = new Storage(base);
      const result = await zip.get("test");
      compareUint8Arrays(result, encode("hello"));
      expect(decode(result)).toBe("hello");
    });
    it("returns deflated Uint8Arrays", async () => {
      expect.hasAssertions();
      const base = getMapStorage();
      const zip = new Storage(base);
      const result = await zip.get("testagain");
      compareUint8Arrays(result, new Uint8Array([0xab, 0xcd]));
    });
    it("works with empty Uint8Arrays", async () => {
      expect.hasAssertions();
      const base = getMapStorage();
      const zip = new Storage(base);
      const result = await zip.get("emptyText");
      compareUint8Arrays(result, new Uint8Array([]));
    });
  };
  describe("ZipStorage", () => {
    describe("get", () => {
      getAssertions(ZipStorage);
    });
  });
  describe("WritableZipStorage", () => {
    describe("get", () => {
      getAssertions(WritableZipStorage);
    });
    describe("set", () => {
      it("can set values", async () => {
        expect.hasAssertions();
        const zip = new WritableZipStorage(new MapStorage());
        const testRoundTrip = async ([k, v]) => {
          await zip.set(k, v);
          const result = await zip.get(k);
          compareUint8Arrays(result, v);
        };
        const validEntries = ((entries.slice(1): any): Array<
          [string, Uint8Array]
        >);
        validEntries.forEach(testRoundTrip);
      });
    });
  });
});
