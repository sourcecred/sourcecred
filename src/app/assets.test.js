// @flow

import {Assets} from "./assets";

describe("app/assets", () => {
  describe("Assets", () => {
    describe("with an unknown root path (null)", () => {
      it("can be constructed", () => {
        const _: Assets = new Assets(null);
      });
      it("fails to resolve anything", () => {
        for (const x of ["", ".", "foo.png", "/foo.png", "/foo/bar/"]) {
          expect(() => new Assets(null).resolve(x)).toThrowError(
            "asset root path uninitialized"
          );
        }
      });
    });

    describe("with an empty root path", () => {
      it("can be constructed", () => {
        const _: Assets = new Assets("");
      });
      it('resolves the root path itself using "."', () => {
        const assets = new Assets("");
        expect(assets.resolve(".")).toEqual(".");
      });
      it('resolves the root directory using "./"', () => {
        const assets = new Assets("");
        expect(assets.resolve("./")).toEqual("./");
      });
      it('resolves the root directory using ""', () => {
        const assets = new Assets("");
        expect(assets.resolve("")).toEqual("./");
      });
      it('resolves an implicitly relative filename ("favicon.png")', () => {
        const assets = new Assets("");
        expect(assets.resolve("favicon.png")).toEqual("favicon.png");
      });
      it('resolves an explicitly relative filename ("./favicon.png")', () => {
        const assets = new Assets("");
        expect(assets.resolve("./favicon.png")).toEqual("favicon.png");
      });
      it('resolves a file by absolute filename ("/favicon.png")', () => {
        const assets = new Assets("");
        expect(assets.resolve("/favicon.png")).toEqual("favicon.png");
      });
      it("errors when given an implicitly relative path above root", () => {
        const assets = new Assets("");
        expect(() => assets.resolve("../foo")).toThrow(
          "path outside site root: ../foo"
        );
      });
      it("errors when given an explicitly relative path above root", () => {
        const assets = new Assets("");
        expect(() => assets.resolve("./../foo")).toThrow(
          "path outside site root: ./../foo"
        );
      });
      it("errors when given an absolute path above root", () => {
        const assets = new Assets("");
        expect(() => assets.resolve("/../foo")).toThrow(
          "path outside site root: /../foo"
        );
      });
    });

    describe('with a relative root path ("../..")', () => {
      it("can be constructed", () => {
        const _: Assets = new Assets("../..");
      });
      it('resolves the root path itself using "."', () => {
        const assets = new Assets("../..");
        expect(assets.resolve(".")).toEqual("../..");
      });
      it('resolves the root directory using "./"', () => {
        const assets = new Assets("../..");
        expect(assets.resolve("./")).toEqual("../../");
      });
      it('resolves the root directory using ""', () => {
        const assets = new Assets("../..");
        expect(assets.resolve("")).toEqual("../../");
      });
      it('resolves an implicitly relative filename ("favicon.png")', () => {
        const assets = new Assets("../..");
        expect(assets.resolve("favicon.png")).toEqual("../../favicon.png");
      });
      it('resolves an explicitly relative filename ("./favicon.png")', () => {
        const assets = new Assets("../..");
        expect(assets.resolve("./favicon.png")).toEqual("../../favicon.png");
      });
      it('resolves a file by absolute filename ("/favicon.png")', () => {
        const assets = new Assets("../..");
        expect(assets.resolve("/favicon.png")).toEqual("../../favicon.png");
      });
      it("errors when given an implicitly relative path above root", () => {
        const assets = new Assets("../..");
        expect(() => assets.resolve("../foo")).toThrow(
          "path outside site root: ../foo"
        );
      });
      it("errors when given an explicitly relative path above root", () => {
        const assets = new Assets("../..");
        expect(() => assets.resolve("./../foo")).toThrow(
          "path outside site root: ./../foo"
        );
      });
      it("errors when given an absolute path above root", () => {
        const assets = new Assets("../..");
        expect(() => assets.resolve("/../foo")).toThrow(
          "path outside site root: /../foo"
        );
      });
    });

    describe('with an absolute root path ("/ab/cd/")', () => {
      it("can be constructed", () => {
        const _: Assets = new Assets("/ab/cd/");
      });
      it('resolves the root path itself using "."', () => {
        const assets = new Assets("/ab/cd/");
        expect(assets.resolve(".")).toEqual("/ab/cd");
      });
      it('resolves the root directory using "./"', () => {
        const assets = new Assets("/ab/cd/");
        expect(assets.resolve("./")).toEqual("/ab/cd/");
      });
      it('resolves the root directory using ""', () => {
        const assets = new Assets("/ab/cd/");
        expect(assets.resolve("")).toEqual("/ab/cd/");
      });
      it('resolves an implicitly relative filename ("favicon.png")', () => {
        const assets = new Assets("/ab/cd/");
        expect(assets.resolve("favicon.png")).toEqual("/ab/cd/favicon.png");
      });
      it('resolves an explicitly relative filename ("./favicon.png")', () => {
        const assets = new Assets("/ab/cd/");
        expect(assets.resolve("./favicon.png")).toEqual("/ab/cd/favicon.png");
      });
      it('resolves a file by absolute filename ("/favicon.png")', () => {
        const assets = new Assets("/ab/cd/");
        expect(assets.resolve("/favicon.png")).toEqual("/ab/cd/favicon.png");
      });
      it("errors when given an implicitly relative path above root", () => {
        const assets = new Assets("/ab/cd/");
        expect(() => assets.resolve("../foo")).toThrow(
          "path outside site root: ../foo"
        );
      });
      it("errors when given an explicitly relative path above root", () => {
        const assets = new Assets("/ab/cd/");
        expect(() => assets.resolve("./../foo")).toThrow(
          "path outside site root: ./../foo"
        );
      });
      it("errors when given an absolute path above root", () => {
        const assets = new Assets("/ab/cd/");
        expect(() => assets.resolve("/../foo")).toThrow(
          "path outside site root: /../foo"
        );
      });
    });
  });
});
