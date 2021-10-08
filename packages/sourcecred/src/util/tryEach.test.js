// @flow

import tryEach from "./tryEach";

describe("util/tryEach", () => {
  it("returns the first if able", () => {
    expect(
      tryEach(
        () => "success",
        () => {
          throw "thunk";
        }
      )
    ).toEqual("success");
    expect(
      tryEach(
        () => "success",
        () => "success2"
      )
    ).toEqual("success");
  });

  it("returns the second if the first fails", () => {
    expect(
      tryEach(
        () => {
          throw "thunk";
        },
        () => "success"
      )
    ).toEqual("success");
  });

  it("throws the last error if all fail", () => {
    expect(() => {
      tryEach(
        () => {
          throw "thunk";
        },
        () => {
          throw "thunk2";
        }
      );
    }).toThrow("thunk2");
  });
});
