// @flow

import {LocalStore} from "./localStore";
import CheckedLocalStore from "./checkedLocalStore";

describe("webutil/checkedLocalStore", () => {
  function makeBase(): LocalStore {
    return {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };
  }

  it("forwards valid `get`", () => {
    const base = makeBase();
    const cls = new CheckedLocalStore(base);
    const whenUnavailable = Symbol("whenUnavailable");
    const result = {key: "lime"};
    base.get.mockReturnValueOnce(result);
    expect(cls.get("quay", whenUnavailable)).toBe(result);
    expect(base.get).toHaveBeenCalledWith("quay", whenUnavailable);
    expect(base.get).toHaveBeenCalledTimes(1);
    expect(base.set).toHaveBeenCalledTimes(0);
    expect(base.del).toHaveBeenCalledTimes(0);
  });

  it("forwards valid `set`", () => {
    const base = makeBase();
    const cls = new CheckedLocalStore(base);
    expect(cls.set("quay", {key: "lime"})).toBe(undefined);
    expect(base.set).toHaveBeenCalledWith("quay", {key: "lime"});
    expect(base.get).toHaveBeenCalledTimes(0);
    expect(base.set).toHaveBeenCalledTimes(1);
    expect(base.del).toHaveBeenCalledTimes(0);
  });

  it("forwards valid `del`", () => {
    const base = makeBase();
    const cls = new CheckedLocalStore(base);
    expect(cls.del("quay")).toBe(undefined);
    expect(base.del).toHaveBeenCalledWith("quay");
    expect(base.get).toHaveBeenCalledTimes(0);
    expect(base.set).toHaveBeenCalledTimes(0);
    expect(base.del).toHaveBeenCalledTimes(1);
  });

  function checkErrorCase(consumeLocalStore: (LocalStore) => void) {
    const base = makeBase();
    const cls = new CheckedLocalStore(base);
    consumeLocalStore(cls);
    expect(base.get).not.toHaveBeenCalled();
    expect(base.set).not.toHaveBeenCalled();
    expect(base.del).not.toHaveBeenCalled();
  }

  it("errors on non-string keys with `get`", () => {
    checkErrorCase((cls) => {
      // $FlowExpectedError[incompatible-call]
      expect(() => cls.get(12)).toThrow("bad key (number): 12");
    });
  });

  it("errors on non-string keys with `set`", () => {
    checkErrorCase((cls) => {
      // $FlowExpectedError[incompatible-call]
      expect(() => cls.set(12, "twelve")).toThrow("bad key (number): 12");
    });
  });

  it("errors on non-string keys with `del`", () => {
    checkErrorCase((cls) => {
      // $FlowExpectedError[incompatible-call]
      expect(() => cls.del(12)).toThrow("bad key (number): 12");
    });
  });

  it("errors on setting ES6 `Map` values", () => {
    checkErrorCase((cls) => {
      expect(() => cls.set("a", new Map())).toThrow("bad value: [object Map]");
    });
  });

  it("errors on setting `undefined`", () => {
    checkErrorCase((cls) => {
      expect(() => cls.set("a", undefined)).toThrow("bad value: undefined");
    });
  });
});
