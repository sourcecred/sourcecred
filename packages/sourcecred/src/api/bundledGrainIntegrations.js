// @flow

import type {GrainIntegrationFunction} from "../core/ledger/grainIntegration";
import * as C from "../util/combo";

import {csvIntegration} from "@sourcecred/grain-integration-csv";

export type GrainIntegration = {|
  name: string,
  function: GrainIntegrationFunction,
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

export const parser: C.Parser<GrainIntegration> = C.fmap(
  C.exactly(["csv"]),
  (integrationKey) => ({
    name: integrationKey,
    function: bundledGrainIntegrations(integrationKey),
  })
);
