// @flow

import {type TimestampMs} from "../../util/timestamp";
import {type OperatorOrKey, operatorKeyParser} from "./operator";
import {type NodeAddressT, NodeAddress} from "../graph";
import * as C from "../../util/combo";

/**
A leaf node in the Expression tree structure. It represents a trait that can
be weighted atomically.
 */
export type WeightOperand = {|
  +key: string,
  +subkey?: string,
|};
export const weightOperandParser: C.Parser<WeightOperand> = C.object(
  {
    key: C.string,
  },
  {subkey: C.string}
);

/**
A recursive type that forms a tree-like structure of algebraic expressions. Can
be evaluated as OPERATOR(...weightOperands, ...expressionOperands).

For example, if the operator is ADD, an expression could be written as:
weightOperand1 + weightOperand2 + expressionOperand1 + ...

The recursive nature of this type allows complex composition of expressions:
ADD(..., MULTIPLY(..., ADD(...)), MAX(...))
 */
export type Expression = {|
  /**
  A string from the Operator enum type (ADD, MUPTIPLY, MAX, ...)
  OR an OperatorConfig key that is an arbitrary string prefixed by "key:"
   */
  +operator: OperatorOrKey,
  /**
  An arbitrary string describing the level of abstraction / semantic
  significance / granularity of this expression.
   */
  +description: string,
  /**
  An array of WeightOperand leaf nodes that are children of this Expression node. Will
  be included as operands when the operator is applied.
   */
  +weightOperands: $ReadOnlyArray<WeightOperand>,
  /**
  An array of Expression nodes that are children of this Expression node. Will
  be recursively evaluated and then included as operands when the operator is 
  applied.
   */
  +expressionOperands: $ReadOnlyArray<Expression>,
|};
const rawExpressionParser = C.object({
  operator: operatorKeyParser,
  description: C.string,
  weightOperands: C.array(weightOperandParser),
  expressionOperands: C.array(C.raw),
});
const expressionParserBuilder: (Object) => Expression = (expression) => {
  rawExpressionParser.parseOrThrow(expression);
  expression.expressionOperands.forEach((expressionOperand) => {
    expressionParserBuilder(expressionOperand);
  });
  return expression;
};
export const expressionParser: C.Parser<Expression> = C.raw.fmap(
  expressionParserBuilder
);

/**
A granular contribution that contains the root node of an Expression tree
and also has an outgoing array of participants, creating a DAG-like structure.

Responsible for timestamping, containing granular participation details, and
linking Expressions to Participants.
 */
export type Contribution = {|
  +id: string,
  +plugin: string,
  +type: string,
  +timestampMs: TimestampMs,
  +expression: Expression,
  +participants: $ReadOnlyArray<{|
    +id: NodeAddressT,
    +shares: $ReadOnlyArray<WeightOperand>,
  |}>,
|};
export const contributionParser: C.Parser<Contribution> = C.object({
  id: C.string,
  plugin: C.string,
  type: C.string,
  timestampMs: C.number,
  expression: expressionParser,
  participants: C.array(
    C.object({
      id: NodeAddress.parser,
      shares: C.array(weightOperandParser),
    })
  ),
});

export type ContributionsByTarget = {[string]: Iterable<Contribution>};
export const contributionsByTargetParser: C.Parser<ContributionsByTarget> = C.dict(
  C.array(contributionParser)
);
