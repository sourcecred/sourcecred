// @flow

import type {PluginDeclaration} from "../analysis/pluginDeclaration";
import type {WeightedGraph} from "../core/weightedGraph";
import type {ReferenceDetector} from "../core/references/referenceDetector";
import type {TaskReporter} from "../util/taskReporter";
import type {IdentityProposal} from "../core/ledger/identityProposal";

export interface Plugin {
  declaration(): Promise<PluginDeclaration>;
  load(PluginDirectoryContext, TaskReporter): Promise<void>;
  graph(
    PluginDirectoryContext,
    ReferenceDetector,
    TaskReporter
  ): Promise<WeightedGraph>;
  referenceDetector(
    PluginDirectoryContext,
    TaskReporter
  ): Promise<ReferenceDetector>;
  identities(
    PluginDirectoryContext,
    TaskReporter
  ): Promise<$ReadOnlyArray<IdentityProposal>>;
  // getContributions(): Promise<$ReadOnlyArray<UnscoredContribution>>
}

export interface PluginDirectoryContext {
  configDirectory(): string;
  cacheDirectory(): string;
}

export type Factor = {|
  key: string,
  value: string,
|};

export type Equation = {|
  type: "MULTIPLY" | "ADD",
  description: string,
  factors: Array<Factor>,
  equationFactors: Array<Equation>,
|};

export type WeightConfig = Array<{|
  key: string,
  default: number,
  values: Array<{|
    value: string,
    weight: number,
  |}>,
|}>;

export type UnscoredContribution = {|
  id: string,
  plugin: string,
  type: string,
  equation: Equation,
  participants: Array<{|
    id: string,
    shares: number,
  |}>,
|};
export type Contribution = {|
  id: string,
  plugin: string,
  type: string,
  equation: Equation,
  participants: Array<{|
    id: string,
    shares: number,
  |}>,
  score: number,
|};

export const exampleDiscordContribution: UnscoredContribution = {
  id: "1234",
  plugin: "Discord",
  type: "Message",
  participants: [
    {id: "ASDVERW342tFD", shares: 1},
    {id: "SD533FEfdsdrG", shares: 3},
  ],
  equation: {
    type: "MULTIPLY",
    description: "contribution attributes",
    factors: [{key: "channel", value: "12345"}],
    equationFactors: [
      {
        type: "ADD",
        description: "reactions",
        factors: [],
        equationFactors: [
          {
            type: "MULTIPLY",
            description: "reaction attributes",
            factors: [
              {key: "emoji", value: "asdf"},
              {key: "role", value: "123445"},
            ],
            equationFactors: [],
          },
        ],
      },
    ],
  },
};

export const exampleDiscordWeightConfig: WeightConfig = [
  {
    key: "channel",
    default: 2,
    values: [
      {value: "12345", weight: 3},
      {value: "45678", weight: 1},
    ],
  },
  {
    key: "emoji",
    default: 1,
    values: [],
  },
  {
    key: "role",
    default: 2,
    values: [],
  },
];

const evaluate: (Equation, WeightConfig) => number = (
  equation,
  weightConfig
) => {
  let equationFactorResult, factorResult;
  switch (equation.type) {
    case "MULTIPLY":
      equationFactorResult = equation.equationFactors.reduce(
        (accumulator, factor) => {
          return (
            evaluate(factor, weightConfig) *
            (accumulator === undefined ? 1 : accumulator)
          );
        },
        1
      );
      factorResult = equation.factors.reduce((accumulator, factor) => {
        const config = weightConfig.find((x) => x.key === factor.key);
        if (config === undefined) throw "Unexpected factor key " + factor.key;
        return (
          (config.values.find((x) => x.value === factor.value)?.weight ||
            config.default) * (accumulator === undefined ? 1 : accumulator)
        );
      }, 1);
      if (equationFactorResult === undefined || factorResult === undefined) {
        throw "not supposed to happen";
      }
      return factorResult * equationFactorResult;

    case "ADD":
      equationFactorResult = equation.equationFactors.reduce(
        (accumulator, factor) => {
          return (
            evaluate(factor, weightConfig) +
            (accumulator === undefined ? 1 : accumulator)
          );
        },
        0
      );
      factorResult = equation.factors.reduce((accumulator, factor) => {
        const config = weightConfig.find((x) => x.key === factor.key);
        if (config === undefined) throw "Unexpected factor key " + factor.key;
        return (
          (config.values.find((x) => x.value === factor.value)?.weight ||
            config.default) + (accumulator === undefined ? 1 : accumulator)
        );
      }, 0);
      if (equationFactorResult === undefined || factorResult === undefined) {
        throw "not supposed to happen";
      }
      return factorResult + equationFactorResult;
  }
};

export function score(
  contribution: UnscoredContribution,
  weightConfig: WeightConfig
): Contribution {
  return {
    ...contribution,
    score: evaluate(contribution.equation, weightConfig),
  };
}
