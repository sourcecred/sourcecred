// @flow

import React from "react";
import {render} from "enzyme";

import AssetsContext, {Assets} from "./assetsContext";

require("./testUtil").configureEnzyme();

describe("app/assetsContext", () => {
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

  describe("AssetsContext", () => {
    class Sample extends React.Component<{||}> {
      render() {
        return (
          <span>
            check out the favicon:
            <AssetsContext.Consumer>
              {(assets) => <img alt="" src={assets.resolve("/favicon.png")} />}
            </AssetsContext.Consumer>
          </span>
        );
      }
    }
    it("provides an uninitialized root by default", () => {
      expect(() => render(<Sample />)).toThrow("asset root path uninitialized");
    });
    it("works as a context", () => {
      const component = (
        <AssetsContext.Provider value={new Assets("../..")}>
          <div>
            <h1>Welcome</h1>
            <Sample />
          </div>
        </AssetsContext.Provider>
      );
      const element = render(component);
      expect(element.find("h1")).toHaveLength(1);
      expect(element.find("img").attr("src")).toEqual("../../favicon.png");
    });
  });
});
