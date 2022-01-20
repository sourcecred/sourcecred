// @flow

import {buildConfig} from "./testUtils";
import {applyOperator} from "./operator";

describe("core/credEquate/operator", () => {
  const config = buildConfig();
  const scoredWeightOperands = [
    {key: "emoji", subkey: "0", score: 0},
    {key: "roles", subkey: "1", score: 1},
    {key: "mention", subkey: "2", score: 2},
    {key: "3", subkey: "3", score: 3},
  ];
  const buildScoredExpressionOperand = (operator, i) => ({
    operator: operator,
    description: "test",
    expressionOperands: [],
    weightOperands: [scoredWeightOperands[i]],
    score: scoredWeightOperands[i].score,
  });

  describe("MULTIPLY", () => {
    const OPERATOR = "MULTIPLY";
    it("scores as 0 when there are no operands", () => {
      expect(applyOperator(OPERATOR, [], [], config)).toEqual(1);
    });

    it("scores as 0 when weightOperands = 0", () => {
      expect(
        applyOperator(OPERATOR, [scoredWeightOperands[0]], [], config)
      ).toEqual(0);
    });
    it("scores as 1 when weightOperands = 1", () => {
      expect(
        applyOperator(OPERATOR, [scoredWeightOperands[1]], [], config)
      ).toEqual(1);
    });
    it("scores as 6 when weightOperands = 2 , 3", () => {
      expect(
        applyOperator(
          OPERATOR,
          [scoredWeightOperands[2], scoredWeightOperands[3]],
          [],
          config
        )
      ).toEqual(6);
    });
    it("scores as 0 when expressionOperands = 0", () => {
      expect(
        applyOperator(
          OPERATOR,
          [],
          [buildScoredExpressionOperand(OPERATOR, 0)],
          config
        )
      ).toEqual(0);
    });
    it("scores as 1 when expressionOperands = 1", () => {
      expect(
        applyOperator(
          OPERATOR,
          [],
          [buildScoredExpressionOperand(OPERATOR, 1)],
          config
        )
      ).toEqual(1);
    });
    it("scores as 6 when expressionOperands = 2 * 3", () => {
      expect(
        applyOperator(
          OPERATOR,
          [],
          [
            buildScoredExpressionOperand(OPERATOR, 2),
            buildScoredExpressionOperand(OPERATOR, 3),
          ],
          config
        )
      ).toEqual(6);
    });
    it("scores as 6 when expressionOperands = 2 and weightOperands = 3", () => {
      expect(
        applyOperator(
          OPERATOR,
          [scoredWeightOperands[3]],
          [buildScoredExpressionOperand(OPERATOR, 2)],
          config
        )
      ).toEqual(6);
    });
  });

  describe("ADD", () => {
    const OPERATOR = "ADD";
    it("scores as 0 when there are no operands", () => {
      expect(applyOperator(OPERATOR, [], [], config)).toEqual(0);
    });

    it("scores as 0 when weightOperands = 0", () => {
      expect(
        applyOperator(OPERATOR, [scoredWeightOperands[0]], [], config)
      ).toEqual(0);
    });
    it("scores as 1 when weightOperands = 1", () => {
      expect(
        applyOperator(OPERATOR, [scoredWeightOperands[1]], [], config)
      ).toEqual(1);
    });
    it("scores as 6 when weightOperands = 2 + 3", () => {
      expect(
        applyOperator(
          OPERATOR,
          [scoredWeightOperands[2], scoredWeightOperands[3]],
          [],
          config
        )
      ).toEqual(5);
    });
    it("scores as 0 when expressionOperands = 0", () => {
      expect(
        applyOperator(
          OPERATOR,
          [],
          [buildScoredExpressionOperand(OPERATOR, 0)],
          config
        )
      ).toEqual(0);
    });
    it("scores as 1 when expressionOperands = 1", () => {
      expect(
        applyOperator(
          OPERATOR,
          [],
          [buildScoredExpressionOperand(OPERATOR, 1)],
          config
        )
      ).toEqual(1);
    });
    it("scores as 6 when expressionOperands = 2 + 3", () => {
      expect(
        applyOperator(
          OPERATOR,
          [],
          [
            buildScoredExpressionOperand(OPERATOR, 2),
            buildScoredExpressionOperand(OPERATOR, 3),
          ],
          config
        )
      ).toEqual(5);
    });
    it("scores as 5 when expressionOperands = 2 and weightOperands = 3", () => {
      expect(
        applyOperator(
          OPERATOR,
          [scoredWeightOperands[3]],
          [buildScoredExpressionOperand(OPERATOR, 2)],
          config
        )
      ).toEqual(5);
    });
  });

  describe("MAX", () => {
    const OPERATOR = "MAX";
    it("scores as 0 when there are no operands", () => {
      expect(applyOperator(OPERATOR, [], [], config)).toEqual(0);
    });

    it("scores as 0 when weightOperands = 0", () => {
      expect(
        applyOperator(OPERATOR, [scoredWeightOperands[0]], [], config)
      ).toEqual(scoredWeightOperands[0].score);
    });
    it("scores max as 1 (default) when weightOperands = 1 (with no explicit weight)", () => {
      expect(
        applyOperator(OPERATOR, [scoredWeightOperands[1]], [], config)
      ).toEqual(scoredWeightOperands[1].score);
    });

    it("scores max as 3 (explicit weight) when weightOperands = 3", () => {
      expect(
        applyOperator(OPERATOR, [scoredWeightOperands[3]], [], config)
      ).toEqual(scoredWeightOperands[3].score);
    });
    it("scores max as 0 when expressionOperands = 0", () => {
      expect(
        applyOperator(
          OPERATOR,
          [],
          [buildScoredExpressionOperand(OPERATOR, 0)],
          config
        )
      ).toEqual(scoredWeightOperands[0].score);
    });
    it("scores as 1 when expressionOperands = 1", () => {
      expect(
        applyOperator(
          OPERATOR,
          [],
          [buildScoredExpressionOperand(OPERATOR, 1)],
          config
        )
      ).toEqual(1);
    });
    it("scores as 3 when expressionOperands = 2 , 3", () => {
      expect(
        applyOperator(
          OPERATOR,
          [],
          [
            buildScoredExpressionOperand(OPERATOR, 2),
            buildScoredExpressionOperand(OPERATOR, 3),
          ],
          config
        )
      ).toEqual(3);
    });
    it("scores as 3 when expressionOperands = 2 and weightOperands = 3", () => {
      expect(
        applyOperator(
          OPERATOR,
          [scoredWeightOperands[3]],
          [buildScoredExpressionOperand(OPERATOR, 2)],
          config
        )
      ).toEqual(3);
    });
  });

  describe("FIRST", () => {
    const OPERATOR = "FIRST";
    it("returns 0 when there are no operands", () => {
      expect(applyOperator(OPERATOR, [], [], config)).toEqual(0);
    });

    it("returns 0 as first when weightOperands = 0", () => {
      expect(
        applyOperator(OPERATOR, [scoredWeightOperands[3]], [], config)
      ).toEqual(scoredWeightOperands[3].score);
    });
    it("returns the first when weightOperands array with length = 1", () => {
      expect(
        applyOperator(OPERATOR, [scoredWeightOperands[3]], [], config)
      ).toEqual(scoredWeightOperands[3].score);
    });

    it("returns 3 as first weightOperand = 3 when weightOperands array with length = 2", () => {
      expect(
        applyOperator(
          OPERATOR,
          [scoredWeightOperands[3], scoredWeightOperands[1]],
          [],
          config
        )
      ).toEqual(scoredWeightOperands[3].score);
    });

    it("returns first weightOperand (with explicit weight) when weightOperands array", () => {
      expect(
        applyOperator(
          OPERATOR,
          [
            scoredWeightOperands[1],
            scoredWeightOperands[2],
            scoredWeightOperands[3],
          ],
          [],
          config
        )
      ).toEqual(scoredWeightOperands[2].score);
    });
    it("returns first when there are only one expressionOperand", () => {
      expect(
        applyOperator(
          OPERATOR,
          [],
          [buildScoredExpressionOperand(OPERATOR, 1)],
          config
        )
      ).toEqual(scoredWeightOperands[1].score);
    });
    it("returns the first in expressionOperands even if there is 1 weightOperands", () => {
      expect(
        applyOperator(
          OPERATOR,
          [scoredWeightOperands[3]],
          [buildScoredExpressionOperand(OPERATOR, 2)],
          config
        )
      ).toEqual(scoredWeightOperands[2].score);
    });
    it("returns the first in expressionOperands array", () => {
      expect(
        applyOperator(
          OPERATOR,
          [],
          [
            buildScoredExpressionOperand(OPERATOR, 2),
            buildScoredExpressionOperand(OPERATOR, 3),
          ],
          config
        )
      ).toEqual(scoredWeightOperands[2].score);
    });
  });

  describe("AVERAGE", () => {
    const OPERATOR = "AVERAGE";
    it("returns 0 when there are no operands", () => {
      expect(applyOperator(OPERATOR, [], [], config)).toEqual(0);
    });

    it("return the same score when the list weightOperands has a single item score = 0", () => {
      expect(
        applyOperator(OPERATOR, [scoredWeightOperands[0]], [], config)
      ).toEqual(scoredWeightOperands[0].score);
    });
    it("return the same score when the list weightOperands has a single item score = 3", () => {
      expect(
        applyOperator(OPERATOR, [scoredWeightOperands[3]], [], config)
      ).toEqual(scoredWeightOperands[3].score);
    });

    // it("returns 0 as first weightOperand = 0 when weightOperands array with length = 2", () => {
    //   const expectedAverage =
    //     (scoredWeightOperands[3].score + scoredWeightOperands[1].score) / 2;
    //   expect(
    //     applyOperator(
    //       OPERATOR,
    //       [scoredWeightOperands[3], scoredWeightOperands[1]],
    //       [],
    //       config
    //     )
    //   ).toEqual(expectedAverage);
    // });

    it("returns average of a list of weightsOperands", () => {
      const expectedAverage =
        (scoredWeightOperands[1].score +
          scoredWeightOperands[2].score +
          scoredWeightOperands[3].score) /
        3;
      expect(
        applyOperator(
          OPERATOR,
          [
            scoredWeightOperands[1],
            scoredWeightOperands[2],
            scoredWeightOperands[3],
          ],
          [],
          config
        )
      ).toEqual(expectedAverage);
    });
    it("returns average of single item in expressionOperands", () => {
      expect(
        applyOperator(
          OPERATOR,
          [],
          [buildScoredExpressionOperand(OPERATOR, 1)],
          config
        )
      ).toEqual(scoredWeightOperands[1].score);
    });
    it("returns average of only list of expressionOperands and no weightOperand", () => {
      expect(
        applyOperator(
          OPERATOR,
          [],
          [
            buildScoredExpressionOperand(OPERATOR, 2),
            buildScoredExpressionOperand(OPERATOR, 3),
          ],
          config
        )
      ).toEqual(2.5);
    });
    it("returns the first in expressionOperands even if there is 1 weightOperands", () => {
      const expectedAverage =
        (scoredWeightOperands[1].score +
          2 * scoredWeightOperands[2].score +
          2 * scoredWeightOperands[3].score) /
        5;
      expect(
        applyOperator(
          OPERATOR,
          [
            scoredWeightOperands[1],
            scoredWeightOperands[2],
            scoredWeightOperands[3],
          ],
          [
            buildScoredExpressionOperand(OPERATOR, 2),
            buildScoredExpressionOperand(OPERATOR, 3),
          ],
          config
        )
      ).toEqual(expectedAverage);
    });
  });
});
