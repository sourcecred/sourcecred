// @flow

import type {TimestampMs} from "../../util/timestamp";
import type {Operator} from "./operator";

/**
A leaf node in the Expression tree structure. It represents a trait that can
be weighted atomically.
 */
export type WeightOperand = {|
  +key: string,
  +subkey: string,
|};

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
  +operator: Operator | string,
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
    +id: string,
    +shares: $ReadOnlyArray<{|
      +key: string,
    |}>,
  |}>,
|};
