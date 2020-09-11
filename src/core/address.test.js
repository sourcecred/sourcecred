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
        // $FlowExpectedError[cannot-write]
        FooAddress.assertValid = FooAddress.assertValid; // eslint-disable-line no-self-assign
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
          // $FlowExpectedError[incompatible-call]
          FooAddress.assertValid(undefined, "widget");
        }).toThrow("widget: expected FooAddress, got: undefined");
      });
      it("rejects `null`", () => {
        expect(() => {
          // $FlowExpectedError[incompatible-call]
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
          // $FlowExpectedError[incompatible-call]
          FooAddress.assertValidParts(undefined, "widget");
        }).toThrow("widget: expected array of parts, got: undefined");
      });
      it("rejects `null`", () => {
        expect(() => {
          // $FlowExpectedError[incompatible-call]
          FooAddress.assertValidParts(null, "widget");
        }).toThrow("widget: expected array of parts, got: null");
      });
      it("rejects an array containing `undefined`", () => {
        expect(() => {
          // $FlowExpectedError[incompatible-call]
          FooAddress.assertValidParts(["hello", undefined, "world"], "widget");
        }).toThrow(
          "widget: expected array of parts, got undefined in: " +
            '["hello",undefined,"world"]'
        );
      });
      it("rejects an array containing `null`", () => {
        expect(() => {
          // $FlowExpectedError[incompatible-call]
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

    describe("empty", () => {
      const {FooAddress} = makeModules();
      it("is a valid address", () => {
        FooAddress.assertValid(FooAddress.empty);
      });
      it("has empty parts", () => {
        expect(FooAddress.toParts(FooAddress.empty)).toEqual([]);
      });
    });

    describe("fromRaw", () => {
      const {FooAddress, BarAddress} = makeModules();
      function thunk(x: string) {
        return () => FooAddress.fromRaw(x);
      }
      it("throws on an empty string", () => {
        expect(thunk("")).toThrow("address does not end with separator");
      });
      it("throws on a string that doesn't start with the right separator", () => {
        expect(thunk("\0")).toThrow("expected FooAddress, got");
      });
      it("throws on a string from a different address module", () => {
        expect(thunk(BarAddress.empty)).toThrow(
          "expected FooAddress, got BarAddress"
        );
      });
      function roundTrip(x) {
        expect(FooAddress.fromRaw(x)).toEqual(x);
      }
      it("works on an empty address", () => {
        roundTrip(FooAddress.empty);
      });
      it("works on a non-empty address", () => {
        roundTrip(FooAddress.fromParts(["foo", "bar"]));
      });
    });

    describe("parser", () => {
      const {FooAddress, BarAddress} = makeModules();
      function thunk(x: string) {
        return () => FooAddress.parser.parseOrThrow(x);
      }
      it("parses a valid address", () => {
        expect(FooAddress.parser.parseOrThrow(FooAddress.empty)).toEqual(
          FooAddress.empty
        );
      });
      it("rejects an empty string", () => {
        expect(thunk("")).toThrow("address does not end with separator");
      });
      it("rejects a string that doesn't start with the right separator", () => {
        expect(thunk("\0")).toThrow("expected FooAddress, got");
      });
      it("rejects an address from the wrong module", () => {
        expect(thunk(BarAddress.empty)).toThrow(
          "expected FooAddress, got BarAddress"
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
          // $FlowExpectedError[incompatible-call]
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
          // $FlowExpectedError[incompatible-call]
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

    describe("hasPrefix", () => {
      const {FooAddress, BarAddress} = makeModules();

      // We use these next tests as a proxy for fully correct
      // validation, in conjunction with tests on `assertValid`.
      it("validates first address kind", () => {
        const fst = BarAddress.fromParts(["hello"]);
        const snd = FooAddress.fromParts(["world"]);
        expect(() => {
          FooAddress.hasPrefix(fst, snd);
        }).toThrow("address: expected FooAddress, got BarAddress:");
      });
      it("validates second address kind", () => {
        const fst = FooAddress.fromParts(["hello"]);
        const snd = BarAddress.fromParts(["world"]);
        expect(() => {
          FooAddress.hasPrefix(fst, snd);
        }).toThrow("prefix: expected FooAddress, got BarAddress");
      });

      const {hasPrefix, fromParts} = FooAddress;
      it("accepts the empty prefix of non-empty input", () => {
        expect(hasPrefix(fromParts(["foo", "bar"]), fromParts([]))).toBe(true);
      });
      it("accepts the empty prefix of empty input", () => {
        expect(hasPrefix(fromParts([]), fromParts([]))).toBe(true);
      });
      it("rejects a non-empty prefix of empty input", () => {
        expect(hasPrefix(fromParts([]), fromParts(["foo", "bar"]))).toBe(false);
      });
      it("accepts a normal input", () => {
        expect(
          hasPrefix(fromParts(["foo", "bar", "baz"]), fromParts(["foo", "bar"]))
        ).toBe(true);
      });
      it("accepts that an address is a prefix of itself", () => {
        expect(
          hasPrefix(fromParts(["foo", "bar"]), fromParts(["foo", "bar"]))
        ).toBe(true);
      });
      it("accepts inputs with empty components", () => {
        expect(
          hasPrefix(
            fromParts(["foo", "", "bar", "", "baz"]),
            fromParts(["foo", "", "bar", ""])
          )
        ).toBe(true);
      });
      it("rejects inputs with no nontrivial common prefix", () => {
        expect(
          hasPrefix(fromParts(["foo", "bar", "baz"]), fromParts(["bar", "foo"]))
        ).toBe(false);
      });
      it("rejects inputs with insufficiently long common prefix", () => {
        expect(
          hasPrefix(
            fromParts(["foo", "bar", "baz"]),
            fromParts(["foo", "quux"])
          )
        ).toBe(false);
      });
      it("rejects when the putative prefix is a proper infix", () => {
        expect(
          hasPrefix(fromParts(["foo", "bar", "baz"]), fromParts(["bar"]))
        ).toBe(false);
      });
      it("rejects when the putative prefix is a proper suffix", () => {
        expect(
          hasPrefix(fromParts(["foo", "bar", "baz"]), fromParts(["bar", "baz"]))
        ).toBe(false);
      });
      it("rejects when the arguments are reversed", () => {
        expect(
          hasPrefix(fromParts(["foo", "bar"]), fromParts(["foo", "bar", "baz"]))
        ).toBe(false);
      });
      it("rejects when the last component is truncated", () => {
        expect(
          hasPrefix(fromParts(["foo", "bar", "baz"]), fromParts(["foo", "ba"]))
        ).toBe(false);
      });
      it("rejects when two components have been concatenated", () => {
        expect(
          hasPrefix(
            fromParts(["foo", "bar", "baz"]),
            fromParts(["foobar", "baz"])
          )
        ).toBe(false);
      });
      it("rejects an extra empty component in the middle of the base", () => {
        expect(
          hasPrefix(fromParts(["foo", "", "baz"]), fromParts(["foo", "baz"]))
        ).toBe(false);
      });
      it("rejects an extra empty component in the middle of the prefix", () => {
        expect(
          hasPrefix(fromParts(["foo", "baz"]), fromParts(["foo", "", "baz"]))
        ).toBe(false);
      });
      it("rejects an extra empty component at the end of the prefix", () => {
        expect(
          hasPrefix(fromParts(["foo", "baz"]), fromParts(["foo", "baz", ""]))
        ).toBe(false);
      });
    });
  });
});
