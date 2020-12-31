// @flow

import {type WeightsI, Weights} from "./weights";

export type {WeightsI};
export {Weights};

import {
  type WeightsT,
  type WeightsJSON,
  empty,
  copy,
  merge,
  toJSON,
  fromJSON,
  compareWeightsT,
} from "./weightsT";

export type {WeightsT, WeightsJSON};
export {empty, copy, merge, toJSON, fromJSON, compareWeightsT};
