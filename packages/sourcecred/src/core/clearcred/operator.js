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

export function operatorFromKey(
  rawKey: string,
  config: Config
): Operator {
  if (!rawKey.startsWith(OPERATOR_KEY_PREFIX))
    throw new Error(
      `Invalid expression operator [${rawKey}]. This is probably a bug in the plugin. Valid operators are ${OPERATORS.toString()} and operator keys should be prefixed with 'key:'`
    );
  const key = rawKey.slice(OPERATOR_KEY_PREFIX.length);
  const operator = config.operators.find(
    (operatorConfig) => key === operatorConfig.key
  )?.operator;
  if (!operator)
    throw new Error(
      `Operator for key [${key}] has not been set in the operators config.`
    );
  if (!OPERATORS.includes(operator))
    throw new Error(
      `Operator [${operator}] for Key [${key}] is an invalid configuration. Please choose from ${OPERATORS.toString()}.`
    );
  return operator;
}

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
