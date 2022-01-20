// @flow
import type {Contribution, Expression} from "./contribution";
import {type Operator, applyOperator, OPERATORS} from "./operator";
import {getWeight, getOperator, type Config} from "./config";
import type {TimestampMs} from "../../util/timestamp";
import findLast from "lodash.findlast";
import type {NodeAddressT} from "../graph";

// TODO finish docstrings

export type ScoredWeightOperand = {|
  +key: string,
  +subkey?: string,
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
    +id: NodeAddressT,
    +shares: $ReadOnlyArray<{|
      +amount: number,
      +key: string,
      +subkey?: string,
    |}>,
    +score: number,
  |}>,
|};

const scoreExpression = (
  expression: Expression,
  config: Config
): ScoredExpression => {
  const scoredExpressionOperands = expression.expressionOperands.map(
    (operand) => scoreExpression(operand, config)
  );
  const scoredWeightOperands = expression.weightOperands.map((operand) => ({
    ...operand,
    score: getWeight(operand, config.weights),
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
      operator: getOperator(operatorKey, config),
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
  let totalShares: number = 0;
  const participants = contribution.participants.map((participant) => {
    const participantShares = participant.shares.map((share) => ({
      ...share,
      amount: getWeight(share, config.shares),
    }));
    const sumParticipantShares: number = participantShares
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

export function* scoreContributions(
  contributions: Iterable<Contribution>,
  configs: $ReadOnlyArray<Config>
): Iterable<ScoredContribution> {
  const orderedConfigs = configs
    .slice()
    .sort((a, b) => a.startTimeMs - b.startTimeMs);
  for (const contribution of contributions) {
    const applicableConfig: Config | void = findLast(
      orderedConfigs,
      (config) => {
        return (config: Config).startTimeMs < contribution.timestampMs;
      }
    );
    if (!applicableConfig) continue;
    yield scoreContribution(contribution, applicableConfig);
  }
}
