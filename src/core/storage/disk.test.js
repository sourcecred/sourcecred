// @flow
import {DiskStorage} from "./disk";
import tmp from "tmp";
import fs from "fs-extra";
import {join as pathJoin} from "path";
// $FlowIgnore[missing-export]
import {TextEncoder, TextDecoder} from "util";

describe("core/storage/disk", () => {
  function tmpWithContents(contents: mixed, dir: string = basedir.name) {
    const name: string = tmp.tmpNameSync({dir});
    fs.writeFileSync(name, JSON.stringify(contents));
    const fname = name.split("/").pop();
    return fname;
  }
  const badPath = () => pathJoin(tmp.dirSync().name, "not-a-real-path");
  const fooDefault = () => ({foo: 1337});
  const basedir = tmp.dirSync();
  const encoder = new TextEncoder();
  // $FlowIgnore[incompatible-call]
  const decoder = new TextDecoder();

  describe("get", () => {
    it("returns an existing file", async () => {
      const instance = new DiskStorage(basedir.name);
      const fname = tmpWithContents(fooDefault());

      const result = await instance.get(fname);
      expect(JSON.parse(decoder.decode(result))).toEqual(fooDefault());
    });
    it("throws if file doesn't exist", async () => {
      const instance = new DiskStorage(basedir.name);
      const thunk = () => instance.get(badPath());
      await expect(thunk).rejects.toThrow("ENOENT");
    });
    it("throws if a normalized path is outside the base path", async () => {
      expect.hasAssertions();
      const instance = new DiskStorage(basedir.name);
      const thunk = () => instance.get("../falseFile");
      expect(thunk).rejects.toThrow("Path construction error");
    });
  });
  describe("set", () => {
    // needed because Uint8Arrays are not deeply equal to buffers according to
    // jest, so we explicitly compare the values
    function compareUint8Arrays(array1: Uint8Array, array2: Uint8Array) {
      array2.forEach((value, i) => {
        expect(value).toBe(array1[i]);
      });
      expect(array1.length).toBe(array1.length);
    }
    const contents = [
      ["test.txt", encoder.encode("hello")],
      ["testagain.txt", new Uint8Array([0xab, 0xcd])],
    ];
    it("invalid UTF-8 cannot survive a roundtrip through text decoder/encoder", () => {
      // This is a sanity check to show that data that doesn't map to a native
      // type can still be handled by DiskStorage
      const roundtrip = (a) =>
        // $FlowIssue[incompatible-call]
        new TextEncoder().encode(new TextDecoder().decode(a));

      const [_, invalidText] = contents[1];
      expect(roundtrip(invalidText).length).not.toEqual(invalidText.length);
    });
    it("can write a file to disk", async () => {
      expect.assertions(9);
      const instance = new DiskStorage(basedir.name);
      for (const [fileName, content] of contents) {
        await instance.set(fileName, content);
        const result = await instance.get(fileName);
        compareUint8Arrays(result, content);
      }
    });
    it("overwrites existing content", async () => {
      expect.assertions(9);
      const instance = new DiskStorage(basedir.name);
      const [fileName] = contents[0];
      for (const [_, content] of contents) {
        await instance.set(fileName, content);
        const result = await instance.get(fileName);
        compareUint8Arrays(result, content);
      }
    });
    it("throws if a normalized path is outside the base path", async () => {
      expect.hasAssertions();
      const instance = new DiskStorage(basedir.name);
      const thunk = () =>
        instance.set("../falseFile", new Uint8Array([0xef, 0x12]));
      expect(thunk).rejects.toThrow("Path construction error");
    });
    it("can set a file with a dot basePath", async () => {
      expect.hasAssertions();
      const instance = new DiskStorage("");
      const fileName = "test.txt";
      const payload = new Uint8Array([5, 6, 7, 8, 9]);
      await instance.set(fileName, payload);
      const result = await instance.get(fileName);
      compareUint8Arrays(payload, result);
      // clean up
      fs.unlinkSync(fileName);
    });
  });
});
