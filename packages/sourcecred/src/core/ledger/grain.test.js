// @flow

import * as G from "./grain";

describe("core/ledger/grain", () => {
  describe("G.format", () => {
    const almostOne = G.sub(G.ONE, G.fromString("1"));

    it("correctly rounds to smallest integer when decimals==0", () => {
      expect(G.format(G.ZERO)).toEqual("0g");
      expect(G.format(G.fromApproximateFloat(0.1))).toEqual("0g");
      expect(G.format(almostOne)).toEqual("0g");
      expect(G.format(G.ONE)).toEqual("1g");
      expect(G.format(G.fromApproximateFloat(1.5))).toEqual("1g");
      expect(G.format(G.fromApproximateFloat(42))).toEqual("42g");
    });
    it("correctly adds comma formatting for large numbers", () => {
      expect(G.format(G.fromApproximateFloat(1337))).toEqual("1,337g");
      expect(G.format(G.fromApproximateFloat(1337), 1)).toEqual("1,337.0g");
      expect(G.format(G.fromApproximateFloat(1337.11))).toEqual("1,337g");
      expect(G.format(G.fromApproximateFloat(1337.11), 1)).toEqual("1,337.1g");
      expect(G.format(G.fromInteger(125000))).toEqual("125,000g");
      expect(G.format(G.fromApproximateFloat(1337042.42), 0)).toEqual(
        "1,337,042g"
      );
      expect(G.format(G.fromApproximateFloat(1337042.42), 2)).toEqual(
        "1,337,042.42g"
      );
    });
    it("correctly handles negative numbers", () => {
      expect(G.format(G.fromApproximateFloat(-0.1))).toEqual("-0g");
      expect(G.format(G.fromApproximateFloat(-1.5))).toEqual("-1g");
      expect(G.format(G.fromApproximateFloat(-42))).toEqual("-42g");
      expect(G.format(G.fromApproximateFloat(-1.5), 1)).toEqual("-1.5g");
      expect(G.format(G.fromApproximateFloat(-1.5), 1)).toEqual("-1.5g");
      expect(G.format(G.fromApproximateFloat(-1337042.42), 0)).toEqual(
        "-1,337,042g"
      );
      expect(G.format(G.fromApproximateFloat(-1337042.42), 2)).toEqual(
        "-1,337,042.42g"
      );
    });
    it("handles full precision", () => {
      expect(G.format(G.ZERO, G.DECIMAL_PRECISION)).toEqual(
        "0.000000000000000000g"
      );
      expect(G.format(G.ONE, G.DECIMAL_PRECISION)).toEqual(
        "1.000000000000000000g"
      );
      expect(
        G.format(G.fromApproximateFloat(0.1), G.DECIMAL_PRECISION)
      ).toEqual("0.100000000000000000g");
      expect(G.format(G.fromString("-12345"), G.DECIMAL_PRECISION)).toEqual(
        "-0.000000000000012345g"
      );
      const v = G.mul(G.fromApproximateFloat(0.01), G.fromString("133704242"));
      expect(G.format(v, G.DECIMAL_PRECISION)).toEqual(
        "1,337,042.420000000000000000g"
      );
    });
    it("supports alternative suffixes", () => {
      expect(G.format(G.fromApproximateFloat(1.5), 0, "SEEDS")).toEqual(
        "1SEEDS"
      );
      expect(G.format(G.fromApproximateFloat(42), 0, "SEEDS")).toEqual(
        "42SEEDS"
      );
      expect(G.format(G.fromApproximateFloat(-1.5), 1, "SEEDS")).toEqual(
        "-1.5SEEDS"
      );
      expect(G.format(G.fromApproximateFloat(-1337042.42), 0, "SEEDS")).toEqual(
        "-1,337,042SEEDS"
      );
    });
    it("throws an error if decimals is not an integer in range [0..decimalPrecision]", () => {
      const badValues = [
        -1,
        -0.5,
        0.33,
        G.DECIMAL_PRECISION + 1,
        Infinity,
        -Infinity,
        NaN,
      ];
      for (const bad of badValues) {
        expect(() => G.format(G.ONE, bad)).toThrowError(
          "must be integer in range"
        );
      }
    });
  });

  describe("G.fromString", () => {
    it("fromString works on valid Grain values", () => {
      expect(G.fromString(G.ONE)).toEqual(G.ONE);
    });
    it("fromString errors on invalid Grain values", () => {
      expect(() => G.fromString("123.4")).toThrowError(
        "Invalid integer: 123.4"
      );
    });
  });

  describe("G.multiplyFloat", () => {
    it("behaves reasonably for tiny grain values", () => {
      expect(G.multiplyFloat(G.fromString("1"), 5)).toEqual(G.fromString("5"));
    });
    it("behaves reasonably for larger grain values", () => {
      expect(G.multiplyFloat(G.ONE, 2)).toEqual(
        G.mul(G.fromString("2"), G.ONE)
      );
    });
    it("has small error on large grain values", () => {
      // To compare with arbitrary precision results, see:
      // https://observablehq.com/@decentralion/grain-arithmetic

      // Within 1 attoGrain of "true" value
      expect(G.multiplyFloat(G.ONE, 1 / 1337)).toEqual(
        G.fromString("747943156320119")
      );

      // Within 300 attoGrain of "true" value
      expect(G.multiplyFloat(G.ONE, Math.PI)).toEqual(
        G.fromString("3141592653589793280")
      );
    });
    it("returns the exact Grain value if multiplying by 1", () => {
      const huge = G.mul(G.ONE, G.ONE);
      expect(G.multiplyFloat(huge, 1)).toEqual(huge);
    });
    it("errors if the multiplier is not finite", () => {
      expect(() => G.multiplyFloat(G.ONE, Infinity)).toThrowError(
        "invalid input"
      );
    });
  });

  describe("G.fromInteger", () => {
    it("works on 0", () => {
      expect(G.fromInteger(0)).toEqual("0");
    });
    it("works on 1", () => {
      expect(G.fromInteger(1)).toEqual(G.ONE);
    });
    it("works on 3", () => {
      expect(G.fromInteger(3)).toEqual("3000000000000000000");
    });
    it("works on -3", () => {
      expect(G.fromInteger(-3)).toEqual("-3000000000000000000");
    });
    it("errors for non-integers", () => {
      for (const bad of [1.2, NaN, Infinity, -Infinity]) {
        const thunk = () => G.fromInteger(bad);
        expect(thunk).toThrowError(`not an integer: ${bad}`);
      }
    });
  });

  describe("G.fromFloatString", () => {
    it("converts human-readable floats to grain", () => {
      expect(G.fromFloatString("1.25")).toEqual(G.multiplyFloat(G.ONE, 1.25));
      expect(G.fromFloatString("0.252525")).toEqual(
        G.multiplyFloat(G.ONE, 0.252525)
      );
      expect(G.fromFloatString((55e5).toString())).toEqual(G.fromInteger(55e5));
      expect(G.fromFloatString("5798.453463776456463539")).toEqual(
        "5798453463776456463539"
      );
      expect(G.fromFloatString("5798.45346377645646353")).toEqual(
        "5798453463776456463530"
      );
    });
    it("handles falsy numbers correctly", () => {
      expect(G.fromFloatString("0")).toEqual(G.fromInteger(0));
    });
    it("handles negative values", () => {
      expect(G.fromFloatString("-5")).toEqual(G.fromInteger(-5));
      expect(G.fromFloatString("-3.625")).toEqual(
        G.multiplyFloat(G.ONE, -3.625)
      );
    });
    it("rejects non-floatstring inputs", () => {
      for (const bad of [9, 1.2, NaN, Infinity, -Infinity]) {
        //$FlowExpectedError[incompatible-call]
        const thunk = () => G.fromFloatString(bad);
        expect(thunk).toThrowError(`not a string: ${bad}`);
      }
      for (const bad of ["a", "Bob", " ", "", "Infinity", "-Infinity"]) {
        const thunk = () => G.fromFloatString(bad);
        expect(thunk).toThrowError(`not a valid number: ${bad}`);
      }
    });
    it("rejects excessive precision", () => {
      for (const bad of [
        ["0.125", 2],
        ["0.575645643453", 11],
        ["5798.4534637764564635439", G.DECIMAL_PRECISION],
      ]) {
        const thunk = () => G.fromFloatString(...bad);
        const [, dec = ""] = bad[0].split(".");
        expect(thunk).toThrowError(
          `Provided decimals ${dec.length} exceed allowable precision ${bad[1]}`
        );
      }
    });
  });

  describe("G.fromApproximateFloat", () => {
    it("G.fromApproximateFloat(1) === G.ONE", () => {
      expect(G.fromApproximateFloat(1)).toEqual(G.ONE);
    });
    it("G.fromApproximateFloat(0.1) === G.ONE / 10", () => {
      const tenth = G.div(G.ONE, G.fromString("10"));
      expect(G.fromApproximateFloat(0.1)).toEqual(tenth);
    });
  });

  describe("toFloatRatio", () => {
    const two = G.mul(G.ONE, G.fromString("2"));
    const three = G.mul(G.ONE, G.fromString("3"));
    const five = G.mul(G.ONE, G.fromString("5"));
    it("handles a one-to-one ratio", () => {
      expect(G.toFloatRatio(G.ONE, G.ONE)).toEqual(1);
    });
    it("handles a larger numerator", () => {
      expect(G.toFloatRatio(two, G.ONE)).toEqual(2);
    });
    it("handles fractional numbers", () => {
      expect(G.toFloatRatio(five, two)).toEqual(2.5);
    });
    it("calculates repeating decimal ratios", () => {
      expect(G.toFloatRatio(five, three)).toEqual(5 / 3);
    });
    it("approximates correctly when Grain values are not exactly equal", () => {
      const almostOne = G.sub(G.ONE, G.fromString("1"));
      expect(G.toFloatRatio(G.ONE, almostOne)).toEqual(1);
    });
    it("handles irrational numbers", () => {
      const bigPi = G.multiplyFloat(G.ONE, Math.PI);
      expect(G.toFloatRatio(bigPi, two)).toEqual(Math.PI / 2);
    });
  });

  describe("splitBudget", () => {
    const g = G.fromString;
    const fail = (budget, scores, why) => {
      const thunk = () => G.splitBudget(budget, scores);
      expect(thunk).toThrowError(why);
    };
    it("errors for negative budget", () => {
      fail(g("-1"), [1, 2, 3], "negative budget");
    });
    it("errors if there are negative scores", () => {
      fail(g("1"), [1, -2, 3], "negative score");
    });
    it("errors if the scores sum to 0", () => {
      fail(g("1"), [0, 0], "total score must be positive, got: 0");
      fail(g("1"), [], "total score must be positive, got: 0");
    });
    it("errors if any scores are not finite", () => {
      for (const b of [NaN, Infinity, -Infinity]) {
        const arr = [1, b, 99];
        fail(G.ONE, arr, `scores must all be finite, got: ${b}`);
      }
    });
    it("handles a 0 budget correctly", () => {
      const split = G.splitBudget(g("0"), [1, 2]);
      expect(split).toEqual(["0", "0"]);
    });
    it("handles an even split correctly", () => {
      const split = G.splitBudget(g("2"), [1, 1]);
      expect(split).toEqual(["1", "1"]);
    });
    it("can make unfair splits when necessary", () => {
      const split = G.splitBudget(g("1"), [1, 1]);
      expect(split).toEqual(["0", "1"]);
    });
    it("handles a situation where each user's score is too small to get Grain", () => {
      const split = G.splitBudget(g("3"), [1 / 4, 1 / 4, 1 / 4, 1 / 4]);
      expect(split).toEqual(["0", "1", "1", "1"]);
    });
    describe("stress testing", () => {
      function _check(scores) {
        const pieces = G.splitBudget(G.ONE, scores);
        let total = g("0");
        const totalScores = scores.reduce((a, b) => a + b);
        for (let i = 0; i < scores.length; i++) {
          total = G.add(total, pieces[i]);
          const ratio = G.toFloatRatio(pieces[i], G.ONE);
          const actual = scores[i] / totalScores;
          expect(ratio).toBeCloseTo(actual, 10);
        }
        expect(total).toEqual(G.ONE);
      }
      function check(scores) {
        const rev = scores.slice().reverse();
        _check(scores);
        _check(rev);
      }
      it("many equal scores", () => {
        check(Array(997).fill(1));
      });
      it("VERY uneven split", () => {
        check([1, 10 ** 100]);
      });
      it("highly unequal scores", () => {
        const scores = [];
        for (let i = 0; i < 100; i++) {
          scores.push(i * i);
        }
        check(scores);
      });
      it("extravagantly unequal scores", () => {
        const scores = [];
        for (let i = 0; i < 100; i++) {
          scores.push(2 ** i);
        }
        check(scores);
      });
      it("late stage capitalism unequal scores", () => {
        const scores = [];
        for (let i = 0; i < 100; i++) {
          scores.push(10 ** i);
        }
        check(scores);
      });
      it("a mix of small and huge scores", () => {
        const scores = [];
        for (let i = 0; i < 50; i += 1) {
          scores.push(0.5 ** i);
          scores.push(7 ** i);
        }
        check(scores);
      });
    });
  });

  describe("sum", () => {
    const n = (x: number) => G.fromString(x.toString());
    it("handles the empty case", () => {
      expect(G.sum([])).toEqual(n(0));
    });
    it("handles a few numbers", () => {
      expect(G.sum([n(1), n(2), n(3)])).toEqual(n(6));
    });
    it("handles negative numbers", () => {
      expect(G.sum([n(1), n(-2), n(-3)])).toEqual(n(-4));
    });
  });
  describe("toFloatString", () => {
    it("works with numbers > 1,000,000 and with decimals", () => {
      expect(
        G.toFloatString(G.fromString("1500000111000000000000000"))
      ).toEqual("1500000.111");
    });
  });
});
