// @flow
import type {Contribution, Expression, WeightOperand} from "./contribution";
import {
  type Operator,
  operatorFromKey,
  applyOperator,
  OPERATOR_KEY_PREFIX,
  OPERATORS,
} from "./operator";
import type {Config} from "./config";
import {getWeight, hasExplicitWeight, getShares} from "./config";
import type {TimestampMs} from "../../util/timestamp";
import findLast from "lodash.findlast";

// TODO docstrings

export type ScoredWeightOperand = {|
  +key: string,
  +value: string,
  +score: number,
|};

export type ScoredExpression = {|
  +operator: Operator,
  +operatorKey?: string,
  +description: string,
  +weightOperands: $ReadOnlyArray<ScoredWeightOperand>,
  +expressionOperands: $ReadOnlyArray<ScoredExpression>,
  +score: number,
|};

export type ScoredContribution = {|
  +id: string,
  +plugin: string,
  +type: string,
  +timestampMs: TimestampMs,
  +expression: ScoredExpression,
  +participants: $ReadOnlyArray<{|
    +id: string,
    +shares: $ReadOnlyArray<{|
      +amount: number,
      +key: string,
    |}>,
    +score: number,
  |}>,
|};

const scoreExpression: (Expression, Config) => ScoredExpression = (
  expression,
  config
) => {
  const scoredExpressionOperands = expression.expressionOperands.map(
    (operand) => scoreExpression(operand, config)
  );
  const scoredWeightOperands = expression.weightOperands.map((operand) => ({
    ...operand,
    score: getWeight(operand, config),
  }));
  let score;
  const operatorOptional = OPERATORS.find((o) => o === expression.operator);
  if (operatorOptional) {
    score = applyOperator(
      operatorOptional,
      scoredWeightOperands,
      scoredExpressionOperands,
      config
    );
  } else {
    const operatorKey = expression.operator;
    const expressionWithParsedOperator = {
      ...expression,
      operator: operatorFromKey(operatorKey, config),
    };
    return {
      ...scoreExpression(expressionWithParsedOperator, config),
      operatorKey,
    };
  }
  if (!scoredExpressionOperands.length && !scoredWeightOperands.length) {
    score = 0;
  }
  return {
    operator: operatorOptional,
    description: expression.description,
    score,
    expressionOperands: scoredExpressionOperands,
    weightOperands: scoredWeightOperands,
  };
};

export const scoreContribution = (
  contribution: Contribution,
  config: Config
): ScoredContribution => {
  const scoredExpression = scoreExpression(contribution.expression, config);
  let totalShares = 0;
  const participants = contribution.participants.map((participant) => {
    const participantShares = participant.shares.map((share) => ({
      ...share,
      amount: getShares(share.key, config),
    }));
    const sumParticipantShares = participantShares
      .map((s) => s.amount)
      .reduce((a, b) => a + b, 0);
    totalShares += sumParticipantShares;
    return {
      ...participant,
      shares: participantShares,
      score: (scoredExpression.score * sumParticipantShares) / totalShares,
    };
  });
  return {
    ...contribution,
    participants,
    expression: scoredExpression,
  };
};

export function scoreContributions(
  contributions: Iterable<Contribution>,
  configs: $ReadOnlyArray<Config>
): Iterable<ScoredContribution> {
  return (function* () {
    const orderedConfigs = configs
      .slice()
      .sort((a, b) => a.startTimeMs - b.startTimeMs);
    const scoredContributions = [];
    for (const contribution of contributions) {
      const applicableConfig: Config | void = findLast(
        orderedConfigs,
        (config) => config.timestampMs < contribution.timestampMs
      );
      if (!applicableConfig) continue;
      yield scoreContribution(contribution, applicableConfig);
    }
  })();
}
