// @flow

import * as P from "../util/combo";

/**
 * A PluginId uniquely identifies a Plugin.
 *
 * Each PluginId takes a `owner/name` format, as in
 * `sourcecred/github`.
 *
 * PluginIds are canonically lower-case.
 */
export opaque type PluginId: string = string;

const regex = /^[a-z0-9-]+$/;

export function fromString(s: string): PluginId {
  s = s.toLowerCase();
  const pieces = s.split("/");
  if (pieces.length !== 2) {
    throw new Error(`PluginId must have exactly one "/" separator; got "${s}"`);
  }
  if (!pieces[0].match(regex)) {
    throw new Error(`plugin owner not valid: "${pieces[0]}"`);
  }
  if (!pieces[1].match(regex)) {
    throw new Error(`plugin name not valid: "${pieces[1]}"`);
  }
  return s;
}

export function getPluginOwner(id: PluginId): string {
  return id.split("/")[0];
}

export function getPluginName(id: PluginId): string {
  return id.split("/")[1];
}

export const parser: P.Parser<PluginId> = P.fmap(P.string, fromString);
