// @flow

import {Assets, rootFromPath} from "./assets";

describe("webutil/assets", () => {
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

  describe("rootFromPath", () => {
    it("throws on the empty path", () => {
      expect(() => rootFromPath("")).toThrow('expected absolute path: ""');
    });
    it('throws on an implicitly relative path ("wat")', () => {
      expect(() => rootFromPath("wat")).toThrow(
        'expected absolute path: "wat"'
      );
    });
    it('throws on an explicitly relative path ("./wat")', () => {
      expect(() => rootFromPath("./wat")).toThrow(
        'expected absolute path: "./wat"'
      );
    });
    describe('returns "." for a path at root', () => {
      it('with no file component ("/")', () => {
        expect(rootFromPath("/")).toEqual(".");
      });
      it('with a file component ("/index.html")', () => {
        expect(rootFromPath("/index.html")).toEqual(".");
      });
      it('with superfluous slashes ("///")', () => {
        expect(rootFromPath("///")).toEqual(".");
      });
      it('with indirection, like "/foo/../"', () => {
        expect(rootFromPath("/foo/../")).toEqual(".");
      });
    });
    describe('returns ".." for a path one level deep', () => {
      it('with no file component ("/foo/")', () => {
        expect(rootFromPath("/foo/")).toEqual("..");
      });
      it('with a file component ("/foo/index.html")', () => {
        expect(rootFromPath("/foo/index.html")).toEqual("..");
      });
      it('with superfluous slashes ("//foo//")', () => {
        expect(rootFromPath("//foo//")).toEqual("..");
      });
      it('with indirection, like "/foo/bar/../"', () => {
        expect(rootFromPath("/foo/bar/../")).toEqual("..");
      });
    });
    describe('returns "../.." for a path two levels deep', () => {
      it('with no file component ("/foo/bar/")', () => {
        expect(rootFromPath("/foo/bar/")).toEqual("../..");
      });
      it('with a file component ("/foo/bar/index.html")', () => {
        expect(rootFromPath("/foo/bar/index.html")).toEqual("../..");
      });
      it('with superfluous slashes ("//foo//bar//")', () => {
        expect(rootFromPath("//foo//bar//")).toEqual("../..");
      });
      it('with indirection, like "/foo/bar/baz/../"', () => {
        expect(rootFromPath("/foo/bar/baz/../")).toEqual("../..");
      });
    });
  });
});
