// @flow

import {NodeAddress} from "../core/graph";
import {ONE, ZERO, fromFloat} from "./grain";
import {fixedAmount, fixedRatio, underpayment} from "./payouts";

describe("src/grain/payouts", () => {
  const foo = NodeAddress.fromParts(["foo"]);
  const bar = NodeAddress.fromParts(["bar"]);

  describe("fixedAmount", () => {
    it("handles the empty case", () => {
      expect(fixedAmount(ZERO, new Map())).toEqual(new Map());
      expect(fixedAmount(ONE, new Map())).toEqual(new Map());
    });
    it("handles a case where no users have score", () => {
      expect(
        fixedAmount(
          fromFloat(2),
          new Map([
            [foo, 0],
            [bar, 0],
          ])
        )
      ).toEqual(
        new Map([
          [foo, ONE],
          [bar, ONE],
        ])
      );
    });
    it("pays full amount to one contributor", () => {
      expect(fixedAmount(ONE, new Map([[foo, 1]]))).toEqual(
        new Map([[foo, ONE]])
      );
    });
    it("splits in proportion to score", () => {
      expect(
        fixedAmount(
          fromFloat(10),
          new Map([
            [foo, 9],
            [bar, 1],
          ])
        )
      ).toEqual(
        new Map([
          [foo, fromFloat(9)],
          [bar, fromFloat(1)],
        ])
      );
    });
    it("errors on invalid total", () => {
      // $ExpectFlowError
      const neg = -1n;
      expect(() => fixedAmount(neg, new Map())).toThrowError(
        "invalid harvestAmount"
      );
    });
  });

  describe("fixedRatio", () => {
    it("works on an empty case", () => {
      expect(fixedRatio(0, new Map(), new Map())).toEqual(new Map());
    });
    it("works on a case where no-one has ever been paid", () => {
      const scores = new Map([
        [foo, 1],
        [bar, 2],
      ]);
      expect(fixedRatio(1, scores, new Map())).toEqual(
        new Map([
          [foo, fromFloat(1)],
          [bar, fromFloat(2)],
        ])
      );
    });
    it("works in a case where everyone is already paid", () => {
      const scores = new Map([
        [foo, 2],
        [bar, 1],
      ]);
      const earnings = new Map([
        [foo, fromFloat(4)],
        [bar, fromFloat(3)],
      ]);
      expect(fixedRatio(2, scores, earnings)).toEqual(
        new Map([
          [foo, ZERO],
          [bar, ZERO],
        ])
      );
    });
    it("works in a case where some are underpaid", () => {
      const scores = new Map([
        [foo, 1],
        [bar, 3],
      ]);
      const earnings = new Map([
        [foo, fromFloat(3)],
        [bar, fromFloat(1)],
      ]);
      expect(fixedRatio(2, scores, earnings)).toEqual(
        new Map([
          [foo, fromFloat(0)],
          [bar, fromFloat(5)],
        ])
      );
    });
    it("errors on invalid inputs", () => {
      const bad = [-1, Infinity, NaN, -Infinity];
      for (const b of bad) {
        expect(() => fixedRatio(b, new Map(), new Map())).toThrowError(
          "invalid grainPerScore"
        );
      }
    });
  });

  describe("underpayment", () => {
    it("handles the empty case", () => {
      expect(underpayment(ZERO, new Map(), new Map())).toEqual(new Map());
    });
    it("distributes proportional to score, if there are no earnings", () => {
      const scores = new Map([
        [foo, 1],
        [bar, 2],
      ]);
      const earnings = new Map();
      const payouts = underpayment(fromFloat(3), scores, earnings);
      expect(payouts).toEqual(
        new Map([
          [foo, fromFloat(1)],
          [bar, fromFloat(2)],
        ])
      );
    });
    it("distributes proportional to score, if everyone was fairly paid", () => {
      const scores = new Map([
        [foo, 1],
        [bar, 2],
      ]);
      const earnings = new Map([
        [foo, fromFloat(2)],
        [bar, fromFloat(4)],
      ]);
      const payouts = underpayment(fromFloat(3), scores, earnings);
      expect(payouts).toEqual(
        new Map([
          [foo, fromFloat(1)],
          [bar, fromFloat(2)],
        ])
      );
    });
    it("will skip over-paid accounts", () => {
      const scores = new Map([
        [foo, 1],
        [bar, 2],
      ]);
      const earnings = new Map([
        [foo, fromFloat(2)],
        [bar, fromFloat(2)],
      ]);
      const payouts = underpayment(fromFloat(2), scores, earnings);
      // After this payment, 6 grain will have been distributed.
      // At that point, foo should have 2 grain, which they already have.
      // So they don't get a distribution, and it all goes to bar.
      const expected = new Map([[bar, fromFloat(2)]]);
      expect(payouts).toEqual(expected);
    });
    it("will 'fill up' slightly overpaid accounts", () => {
      const scores = new Map([
        [foo, 1],
        [bar, 1],
      ]);
      const earnings = new Map([
        [foo, fromFloat(1)],
        [bar, fromFloat(2)],
      ]);
      const payouts = underpayment(fromFloat(7), scores, earnings);
      // After the payout, 10 grain will have been distributed.
      // Since foo and bar have equal scores, they should each have 5.
      const expected = new Map([
        [foo, fromFloat(4)],
        [bar, fromFloat(3)],
      ]);
      expect(payouts).toEqual(expected);
    });
    it("handles a case where some users have no reported earnings", () => {
      const scores = new Map([
        [foo, 1],
        [bar, 1],
      ]);
      const earnings = new Map([[foo, fromFloat(1)]]);
      const payouts = underpayment(fromFloat(1), scores, earnings);
      const expected = new Map([[bar, fromFloat(1)]]);
      expect(payouts).toEqual(expected);
    });
    it("handles a case where some users have earnings but no reported score", () => {
      const scores = new Map([[bar, 1]]);
      const earnings = new Map([[foo, fromFloat(1)]]);
      const payouts = underpayment(fromFloat(1), scores, earnings);
      const expected = new Map([[bar, fromFloat(1)]]);
      expect(payouts).toEqual(expected);
    });
    it("splits rewards evenly if no users have any score", () => {
      const scores = new Map([
        [foo, 0],
        [bar, 0],
      ]);
      const earnings = new Map([[foo, fromFloat(1)]]);
      const payouts = underpayment(fromFloat(2), scores, earnings);
      // In principle, it should probably give more to bar since bar was never paid.
      // But this is an extreme edge case, we're just checking that we have some
      // documented and consistent behavior.
      expect(payouts).toEqual(
        new Map([
          [foo, fromFloat(1)],
          [bar, fromFloat(1)],
        ])
      );
    });
  });
});
