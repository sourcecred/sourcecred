// @flow
import type {ScoredExpression, ScoredWeightOperand} from "./scoredContribution";
import {getWeight, hasExplicitWeight, type Config} from "./config";

const OPERATORS_FUNCTION_MAP = {
  "MULTIPLY": multiply,
  "ADD": add,
  "MAX": max,
};
export const OPERATORS: $ReadOnlyArray<Operator> = Array.from(
  Object.keys(OPERATORS_FUNCTION_MAP)
);
export type Operator = $Keys<typeof OPERATORS_FUNCTION_MAP>;
export const OPERATOR_KEY_PREFIX = "key:";

export function applyOperator(
  operator: Operator,
  scoredWeightOperands: $ReadOnlyArray<ScoredWeightOperand>,
  scoredExpressionOperands: $ReadOnlyArray<ScoredExpression>,
  config: Config
): number {
  const f = OPERATORS_FUNCTION_MAP[operator];
  return f(scoredWeightOperands, scoredExpressionOperands, config);
}

function multiply(
  scoredWeightOperands: $ReadOnlyArray<ScoredWeightOperand>,
  scoredExpressionOperands: $ReadOnlyArray<ScoredExpression>,
  _: Config
): number {
  const expressionOperandResult = scoredExpressionOperands.reduce(
    (accumulator, operand) => {
      return accumulator * operand.score;
    },
    1
  );
  const weightOperandResult = scoredWeightOperands.reduce(
    (accumulator, operand) => {
      return accumulator * operand.score;
    },
    1
  );
  return weightOperandResult * expressionOperandResult;
}

function add(
  scoredWeightOperands: $ReadOnlyArray<ScoredWeightOperand>,
  scoredExpressionOperands: $ReadOnlyArray<ScoredExpression>,
  _: Config
): number {
  const expressionOperandResult = scoredExpressionOperands.reduce(
    (accumulator, operand) => {
      return accumulator + operand.score;
    },
    0
  );
  const weightOperandResult = scoredWeightOperands.reduce(
    (accumulator, operand) => {
      return accumulator + operand.score;
    },
    0
  );
  return weightOperandResult + expressionOperandResult;
}

function max(
  scoredWeightOperands: $ReadOnlyArray<ScoredWeightOperand>,
  scoredExpressionOperands: $ReadOnlyArray<ScoredExpression>,
  config: Config
): number {
  const expressionOperandResult = Math.max(
    ...scoredExpressionOperands.map((o) => o.score),
    -Infinity
  );
  const weightOperandResult = Math.max(
    ...scoredWeightOperands.map(
      ({key, subkey}) =>
        hasExplicitWeight({key, subkey}, config)
          ? getWeight({key, subkey}, config)
          : -Infinity,
      -Infinity
    )
  );
  const result = Math.max(weightOperandResult, expressionOperandResult);
  if (result > -Infinity) return result;
  if (scoredWeightOperands.length) {
    return scoredWeightOperands[0].score;
  }
  return 0;
}
