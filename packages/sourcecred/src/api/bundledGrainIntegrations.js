// @flow

import type {
  GrainIntegration,
  GrainIntegrationFunction,
} from "../core/ledger/grainIntegration";
import * as C from "../util/combo";

import {csvIntegration} from "@sourcecred/grain-integration-csv";

export type RawGrainIntegration = {|
  type: string,
  config?: Object,
|};

type AllowedDeclarations = {[pluginKey: string]: GrainIntegrationFunction};

const allowedDeclarations: AllowedDeclarations = {
  "csv": csvIntegration,
};

export function bundledGrainIntegrations(
  integrationKey: string
): GrainIntegrationFunction {
  const integration = allowedDeclarations[integrationKey];
  if (!integration)
    throw new Error(
      "grain integration not found; enter a valid `integration` value in config/grain.json"
    );
  return integration;
}

export const rawParser: C.Parser<RawGrainIntegration> = C.object(
  {
    type: C.exactly(["csv"]),
  },
  {config: C.raw}
);

function upgrade(c: RawGrainIntegration): GrainIntegration {
  const {type, config} = c;
  return {
    name: type,
    function: bundledGrainIntegrations(type),
    config,
  };
}
export const parser: C.Parser<GrainIntegration> = C.fmap(rawParser, upgrade);
