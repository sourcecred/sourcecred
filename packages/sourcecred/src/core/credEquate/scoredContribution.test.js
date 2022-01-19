// @flow
import type {Config} from "./config";
import type {WeightOperand, Contribution} from "./contribution";
import type {ScoredWeightOperand} from "./scoredContribution";
import {scoreContribution} from "./scoredContribution";
import {NodeAddress} from "../graph";

describe("core/credEquate/scoredContribution", () => {
  const config: Config = {
    weights: [
      {
        key: "1",
        default: 1,
        subkeys: [
          {subkey: "2", weight: 2},
          {subkey: "0", weight: 0},
        ],
      },
      {
        key: "3",
        default: 1,
        subkeys: [{subkey: "3", weight: 3}],
      },
    ],
    operators: [],
    shares: [
      {
        key: "author",
        default: 1,
        subkeys: [
          {subkey: "2", weight: 2},
          {subkey: "0", weight: 0},
        ],
      },
    ],
    memo: "test",
    startTimeMs: -Infinity,
  };
  const weightOperands: $ReadOnlyArray<WeightOperand> = [
    {key: "1", subkey: "0"},
    {key: "1", subkey: "1"},
    {key: "1", subkey: "2"},
    {key: "3", subkey: "3"},
  ];
  const scoredWeightOperands: $ReadOnlyArray<ScoredWeightOperand> = [
    {key: "1", subkey: "0", score: 0},
    {key: "1", subkey: "1", score: 1},
    {key: "1", subkey: "2", score: 2},
    {key: "3", subkey: "3", score: 3},
  ];
  const buildExpressionOperand = (i) => ({
    operator: "ADD",
    description: "test",
    expressionOperands: [],
    weightOperands: [weightOperands[i]],
  });
  const buildScoredExpressionOperand = (i) => ({
    operator: "ADD",
    description: "test",
    expressionOperands: [],
    weightOperands: [scoredWeightOperands[i]],
    score: scoredWeightOperands[i].score,
  });
  const contributionStarter = {
    id: "123",
    plugin: "myPlugin",
    type: "message",
    timestampMs: 1,
    participants: [
      {id: NodeAddress.fromParts(["123"]), shares: [{key: "author"}]},
    ],
  };
  const scoredContributionStarter = (score) => ({
    id: "123",
    plugin: "myPlugin",
    type: "message",
    timestampMs: 1,
    participants: [
      {
        id: NodeAddress.fromParts(["123"]),
        score,
        shares: [{key: "author", amount: 1}],
      },
    ],
  });

  describe("MULTIPLY", () => {
    it("scores as 0 when there are no operands", () => {
      const contribution: Contribution = {
        ...contributionStarter,
        expression: {
          operator: "MULTIPLY",
          description: "test",
          expressionOperands: [],
          weightOperands: [],
        },
      };
      expect(scoreContribution(contribution, config)).toEqual({
        ...scoredContributionStarter(0),
        expression: {
          operator: "MULTIPLY",
          description: "test",
          expressionOperands: [],
          weightOperands: [],
          score: 0,
        },
      });
    });
    it("scores as 0 when weightOperands = 0", () => {
      const contribution: Contribution = {
        ...contributionStarter,
        expression: {
          operator: "MULTIPLY",
          description: "test",
          expressionOperands: [],
          weightOperands: [weightOperands[0]],
        },
      };
      expect(scoreContribution(contribution, config)).toEqual({
        ...scoredContributionStarter(0),
        expression: {
          operator: "MULTIPLY",
          description: "test",
          expressionOperands: [],
          weightOperands: [scoredWeightOperands[0]],
          score: 0,
        },
      });
    });
    it("scores as 1 when weightOperands = 1", () => {
      const contribution: Contribution = {
        ...contributionStarter,
        expression: {
          operator: "MULTIPLY",
          description: "test",
          expressionOperands: [],
          weightOperands: [weightOperands[1]],
        },
      };
      expect(scoreContribution(contribution, config)).toEqual({
        ...scoredContributionStarter(1),
        expression: {
          operator: "MULTIPLY",
          description: "test",
          expressionOperands: [],
          weightOperands: [scoredWeightOperands[1]],
          score: 1,
        },
      });
    });
    it("scores as 6 when weightOperands = 2 * 3", () => {
      const contribution: Contribution = {
        ...contributionStarter,
        expression: {
          operator: "MULTIPLY",
          description: "test",
          expressionOperands: [],
          weightOperands: [weightOperands[2], weightOperands[3]],
        },
      };
      expect(scoreContribution(contribution, config)).toEqual({
        ...scoredContributionStarter(6),
        expression: {
          operator: "MULTIPLY",
          description: "test",
          expressionOperands: [],
          weightOperands: [scoredWeightOperands[2], scoredWeightOperands[3]],
          score: 6,
        },
      });
    });
    it("scores as 0 when equationOperands = 0", () => {
      const contribution: Contribution = {
        ...contributionStarter,
        expression: {
          operator: "MULTIPLY",
          description: "test",
          expressionOperands: [buildExpressionOperand(0)],
          weightOperands: [],
        },
      };
      expect(scoreContribution(contribution, config)).toEqual({
        ...scoredContributionStarter(0),
        expression: {
          operator: "MULTIPLY",
          description: "test",
          expressionOperands: [buildScoredExpressionOperand(0)],
          weightOperands: [],
          score: 0,
        },
      });
    });
    it("scores as 1 when equationOperands = 1", () => {
      const contribution: Contribution = {
        ...contributionStarter,
        expression: {
          operator: "MULTIPLY",
          description: "test",
          expressionOperands: [buildExpressionOperand(1)],
          weightOperands: [],
        },
      };
      expect(scoreContribution(contribution, config)).toEqual({
        ...scoredContributionStarter(1),
        expression: {
          operator: "MULTIPLY",
          description: "test",
          expressionOperands: [buildScoredExpressionOperand(1)],
          weightOperands: [],
          score: 1,
        },
      });
    });
    it("scores as 6 when equationOperands = 2 * 3", () => {
      const contribution: Contribution = {
        ...contributionStarter,
        expression: {
          operator: "MULTIPLY",
          description: "test",
          expressionOperands: [
            buildExpressionOperand(2),
            buildExpressionOperand(3),
          ],
          weightOperands: [],
        },
      };
      expect(scoreContribution(contribution, config)).toEqual({
        ...scoredContributionStarter(6),
        expression: {
          operator: "MULTIPLY",
          description: "test",
          expressionOperands: [
            buildScoredExpressionOperand(2),
            buildScoredExpressionOperand(3),
          ],
          weightOperands: [],
          score: 6,
        },
      });
    });
    it("scores as 6 when equationOperands = 2 and weightOperands = 3", () => {
      const contribution: Contribution = {
        ...contributionStarter,
        expression: {
          operator: "MULTIPLY",
          description: "test",
          expressionOperands: [buildExpressionOperand(2)],
          weightOperands: [weightOperands[3]],
        },
      };
      expect(scoreContribution(contribution, config)).toEqual({
        ...scoredContributionStarter(6),
        expression: {
          operator: "MULTIPLY",
          description: "test",
          expressionOperands: [buildScoredExpressionOperand(2)],
          weightOperands: [scoredWeightOperands[3]],
          score: 6,
        },
      });
    });
  });
});
