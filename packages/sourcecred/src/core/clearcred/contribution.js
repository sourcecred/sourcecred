// @flow

import type {TimestampMs} from "../../util/timestamp";
import type {Operator} from "./operator";

export type WeightOperand = {|
  +key: string,
  +value: string,
|};

export type Expression = {|
  +operator: Operator | string,
  +description: string,
  +weightOperands: $ReadOnlyArray<WeightOperand>,
  +expressionOperands: $ReadOnlyArray<Expression>,
|};

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
