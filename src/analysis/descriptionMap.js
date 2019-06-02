// @flow

// TODO: Consider de-duplicating this module with analysis/temporal/timestampMap.js,
// or better yet: rmove the need for both modules by packaging descriptions and timestamps
// directly with the graph. Doing so will also be more space efficient, as we will avoid
// repetitiously saving the node addresses as keys.
import path from "path";
import fs from "fs-extra";
import stringify from "json-stable-stringify";
import * as MapUtil from "../util/map";
import {type RepoId, repoIdToString} from "../core/repoId";
import {type NodeAddressT, NodeAddress} from "../core/graph";
import {type IAnalysisAdapter} from "./analysisAdapter";
import {NodeTrie} from "../core/trie";

export type DescriptionMap = Map<NodeAddressT, string | null>;

export function createDescriptionMap(
  nodes: Iterable<NodeAddressT>,
  adapters: $ReadOnlyArray<IAnalysisAdapter>
): DescriptionMap {
  const adapterTrie: NodeTrie<IAnalysisAdapter> = new NodeTrie();
  for (const adapter of adapters) {
    adapterTrie.add(adapter.declaration().nodePrefix, adapter);
  }
  const result = new Map();
  for (const node of nodes) {
    const adapter = adapterTrie.getLast(node);
    if (adapter == null) {
      throw new Error(`No adapter for ${NodeAddress.toString(node)}`);
    }
    result.set(node, adapter.description(node));
  }
  return result;
}

const DESCRIPTION_FILE = "descriptions.json";
function basepath(sourcecredDirectory: string, repoId: RepoId) {
  return path.join(sourcecredDirectory, "data", repoIdToString(repoId));
}
function filepath(sourcecredDirectory: string, repoId: RepoId) {
  return path.join(basepath(sourcecredDirectory, repoId), DESCRIPTION_FILE);
}

export function writeDescriptionMap(
  stamps: DescriptionMap,
  sourcecredDirectory: string,
  repoId: RepoId
) {
  fs.ensureDirSync(basepath(sourcecredDirectory, repoId));
  const jsonString = stringify(MapUtil.toObject(stamps));
  fs.writeFileSync(filepath(sourcecredDirectory, repoId), jsonString);
}

export function readDescriptionMap(
  sourcecredDirectory: string,
  repoId: RepoId
): DescriptionMap {
  const contents = fs.readFileSync(filepath(sourcecredDirectory, repoId));
  return MapUtil.fromObject(JSON.parse(contents.toString()));
}
