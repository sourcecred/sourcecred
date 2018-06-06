// @flow

import {makeAddressModule} from "./address";

describe("core/address", () => {
  describe("makeAddressModule", () => {
    const makeModules = () => ({
      FooAddress: makeAddressModule({
        name: "FooAddress",
        nonce: "F",
        otherNonces: new Map().set("B", "BarAddress"),
      }),
      BarAddress: makeAddressModule({
        name: "BarAddress",
        nonce: "B",
        otherNonces: new Map().set("F", "FooAddress"),
      }),
      WatAddress: makeAddressModule({
        name: "WatAddress",
        nonce: "W",
        otherNonces: new Map(),
      }),
    });

    it("makes an address module given the mandatory options", () => {
      makeAddressModule({name: "FooAddress", nonce: "F"});
    });
    it("makes address modules using all the options", () => {
      makeModules();
    });
    it("rejects a module whose nonce contains NUL", () => {
      expect(() => {
        makeAddressModule({name: "BadAddress", nonce: "n\0o"});
      }).toThrow("invalid nonce (contains NUL):");
    });
    it("rejects a module with `otherNonces` containing NUL", () => {
      expect(() => {
        makeAddressModule({
          name: "GoodAddress",
          nonce: "G",
          otherNonces: new Map().set("n\0o", "BadAddress"),
        });
      }).toThrow("invalid otherNonce (contains NUL):");
    });
    it("rejects a module with `nonce` in `otherNonces`", () => {
      expect(() => {
        makeAddressModule({
          name: "GoodAddress",
          nonce: "G",
          otherNonces: new Map().set("G", "WatAddress"),
        });
      }).toThrow("primary nonce listed as otherNonce");
    });
    it("returns an object with read-only properties", () => {
      const {FooAddress} = makeModules();
      expect(() => {
        // $ExpectFlowError
        FooAddress.assertValid = FooAddress.assertValid;
      }).toThrow(/read.only property/);
    });

    it("has a stable internal representation", () => {
      const input = ["", "hello", "", "", "sweet", "world", "", "", ""];
      const address = makeModules().FooAddress.fromParts(input);
      // We stringify the address here because otherwise literal NUL
      // characters will appear in the snapshot file.
      expect(JSON.stringify(address)).toMatchSnapshot();
    });

    describe("assertValid", () => {
      const {FooAddress, BarAddress, WatAddress} = makeModules();
      it("rejects `undefined`", () => {
        expect(() => {
          // $ExpectFlowError
          FooAddress.assertValid(undefined, "widget");
        }).toThrow("widget: expected FooAddress, got: undefined");
      });
      it("rejects `null`", () => {
        expect(() => {
          // $ExpectFlowError
          FooAddress.assertValid(null, "widget");
        }).toThrow("widget: expected FooAddress, got: null");
      });
      it("rejects an address from a known module", () => {
        const bar = BarAddress.fromParts(["hello"]);
        expect(() => {
          FooAddress.assertValid(bar, "widget");
        }).toThrow("widget: expected FooAddress, got BarAddress:");
      });
      it("rejects an address from an unknown module", () => {
        const wat = WatAddress.fromParts(["hello"]);
        expect(() => {
          FooAddress.assertValid(wat, "widget");
        }).toThrow("widget: expected FooAddress, got:");
      });
      it("rejects a string that starts with the nonce but no separator", () => {
        expect(() => {
          FooAddress.assertValid("F/things\0", "widget");
        }).toThrow("widget: expected FooAddress, got:");
      });
      it("rejects a string that does not end with a separator", () => {
        const address = FooAddress.fromParts(["hello"]);
        const truncated = address.substring(0, address.length - 2);
        expect(() => {
          FooAddress.assertValid(truncated, "widget");
        }).toThrow("widget: expected FooAddress, got:");
      });
      it("rejects junk", () => {
        expect(() => {
          FooAddress.assertValid("junk", "widget");
        }).toThrow("widget: expected FooAddress, got:");
      });
    });

    describe("assertValidParts", () => {
      const {FooAddress} = makeModules();
      it("rejects `undefined`", () => {
        expect(() => {
          // $ExpectFlowError
          FooAddress.assertValidParts(undefined, "widget");
        }).toThrow("widget: expected array of parts, got: undefined");
      });
      it("rejects `null`", () => {
        expect(() => {
          // $ExpectFlowError
          FooAddress.assertValidParts(null, "widget");
        }).toThrow("widget: expected array of parts, got: null");
      });
      it("rejects an array containing `undefined`", () => {
        expect(() => {
          // $ExpectFlowError
          FooAddress.assertValidParts(["hello", undefined, "world"], "widget");
        }).toThrow(
          "widget: expected array of parts, got undefined in: " +
            '["hello",undefined,"world"]'
        );
      });
      it("rejects an array containing `null`", () => {
        expect(() => {
          // $ExpectFlowError
          FooAddress.assertValidParts(["hello", null, "world"], "widget");
        }).toThrow(
          "widget: expected array of parts, got null in: " +
            '["hello",null,"world"]'
        );
      });
      it("rejects an array with a string containing a NUL character", () => {
        expect(() => {
          FooAddress.assertValidParts(["hello", "n\0o", "world"], "widget");
        }).toThrow(
          "widget: part contains NUL character: " +
            '"n\\u0000o" in ["hello","n\\u0000o","world"]'
        );
      });
    });

    describe("fromParts", () => {
      const {FooAddress, BarAddress} = makeModules();

      // We use this next test as a proxy for fully correct validation,
      // in conjunction with tests on `assertValid` and
      // `assertValidParts`.
      it("validates parts", () => {
        expect(() => {
          // $ExpectFlowError
          FooAddress.fromParts(["hello", null, "world"]);
        }).toThrow(
          'expected array of parts, got null in: ["hello",null,"world"]'
        );
      });

      it("encodes the address kind for the empty address", () => {
        const foo = FooAddress.fromParts([]);
        const bar = BarAddress.fromParts([]);
        expect(foo).not.toEqual(bar);
      });
      it("encodes the address kind for a normal address", () => {
        const foo = FooAddress.fromParts(["hello", "world"]);
        const bar = BarAddress.fromParts(["hello", "world"]);
        expect(foo).not.toEqual(bar);
      });
    });

    describe("toParts", () => {
      const {FooAddress, BarAddress} = makeModules();

      // We use this next test as a proxy for fully correct validation,
      // in conjunction with tests on `assertValid`.
      it("validates address kind", () => {
        const bar = BarAddress.fromParts(["hello"]);
        expect(() => {
          FooAddress.toParts(bar);
        }).toThrow("expected FooAddress, got BarAddress:");
      });

      describe("is a left identity for `fromParts`", () => {
        function check(description, inputParts) {
          it(description, () => {
            const address = FooAddress.fromParts(inputParts);
            const parts = FooAddress.toParts(address);
            expect(parts).toEqual(inputParts);
          });
        }
        check("on the empty input", []);
        check("on an input made of one empty part", [""]);
        check("on an input made of lots of empty parts", ["", "", ""]);
        check("on an input with lots of empty parts throughout", [
          ...["", ""],
          "hello",
          ...["", "", ""],
          "sweet",
          "world",
          ...["", "", "", ""],
        ]);
        check("on a singleton input", ["jar"]);
        check("on an input with repeated components", ["jar", "jar"]);
      });
    });

    describe("toString", () => {
      const {FooAddress, BarAddress} = makeModules();
      const partsToString = (parts) =>
        FooAddress.toString(FooAddress.fromParts(parts));

      // We use this next test as a proxy for fully correct validation,
      // in conjunction with tests on `assertValid`.
      it("validates address kind", () => {
        const bar = BarAddress.fromParts(["hello"]);
        expect(() => {
          FooAddress.toString(bar);
        }).toThrow("expected FooAddress, got BarAddress:");
      });

      it("includes the address kind", () => {
        expect(partsToString(["hello", "world"])).toContain("FooAddress");
      });
      it("includes the address parts", () => {
        expect(partsToString(["hello", "world"])).toContain("hello");
        expect(partsToString(["hello", "world"])).toContain("world");
      });
      it("does not include any NUL characters", () => {
        expect(partsToString(["hello", "world"])).not.toContain("\0");
      });
      it("works on the empty address", () => {
        expect(partsToString([])).toEqual(expect.anything());
      });
      it("differentiates empty components", () => {
        // Each of the following should have a different `toString` form.
        const inputs = [
          partsToString([]),
          partsToString([""]),
          partsToString(["", ""]),
          partsToString(["hello", "world"]),
          partsToString(["", "hello", "world"]),
          partsToString(["", "hello", "", "world"]),
          partsToString(["", "hello", "", "", "world"]),
          partsToString(["", "hello", "", "", "world", ""]),
          partsToString(["", "hello", "", "", "world", "", ""]),
          partsToString(["", "hello", "", "", "world", "", "", ""]),
        ];
        expect(Array.from(new Set(inputs)).sort()).toHaveLength(inputs.length);
      });
    });

    describe("append", () => {
      const {FooAddress, BarAddress} = makeModules();

      // We use these next tests as a proxy for fully correct
      // validation, in conjunction with tests on `assertValid` and
      // `assertValidParts`.
      it("validates address kind", () => {
        const bar = BarAddress.fromParts(["hello"]);
        expect(() => {
          FooAddress.append(bar, "world");
        }).toThrow("expected FooAddress, got BarAddress:");
      });
      it("validates components", () => {
        const foo = FooAddress.fromParts(["hello"]);
        expect(() => {
          // $ExpectFlowError
          FooAddress.append(foo, "world", null);
        }).toThrow('expected array of parts, got null in: ["world",null]');
      });

      describe("is equivalent to the part-wise implementation on", () => {
        function check(description, baseParts, ...moreParts) {
          it(description, () => {
            const base = FooAddress.fromParts(baseParts);
            const actual = FooAddress.append(base, ...moreParts);
            const expected = FooAddress.fromParts([...baseParts, ...moreParts]);
            expect(actual).toEqual(expected);
          });
        }

        check("the null address with nothing", []);
        check("the null address with an empty component", [], "");
        check("the null address with a nonempty component", [], "a");
        check("the null address with lots of components", [], "a", "", "b");

        const base = ["a", "", "b", ""];
        check("a longer address with nothing", base);
        check("a longer address with an empty component", base, "");
        check("a longer address with a nonempty component", base, "c");
        check("a longer address with lots of components", base, "c", "", "d");
      });
    });
  });
});
