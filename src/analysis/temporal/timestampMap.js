// @flow

import path from "path";
import fs from "fs-extra";
import stringify from "json-stable-stringify";
import * as MapUtil from "../../util/map";
import {type RepoId, repoIdToString} from "../../core/repoId";
import {type NodeAddressT, NodeAddress} from "../../core/graph";
import {type IAnalysisAdapter, type MsSinceEpoch} from "../analysisAdapter";
import {NodeTrie} from "../../core/trie";

export type TimestampMap = Map<NodeAddressT, MsSinceEpoch | null>;

export function createTimestampMap(
  nodes: Iterable<NodeAddressT>,
  adapters: $ReadOnlyArray<IAnalysisAdapter>
): TimestampMap {
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
    result.set(node, adapter.createdAt(node));
  }
  return result;
}

const TIMESTAMP_FILE = "timestamps.json";
function basepath(sourcecredDirectory: string, repoId: RepoId) {
  return path.join(sourcecredDirectory, "data", repoIdToString(repoId));
}
function filepath(sourcecredDirectory: string, repoId: RepoId) {
  return path.join(basepath(sourcecredDirectory, repoId), TIMESTAMP_FILE);
}

export function writeTimestampMap(
  stamps: TimestampMap,
  sourcecredDirectory: string,
  repoId: RepoId
) {
  fs.ensureDirSync(basepath(sourcecredDirectory, repoId));
  const jsonString = stringify(MapUtil.toObject(stamps));
  fs.writeFileSync(filepath(sourcecredDirectory, repoId), jsonString);
}

export function readTimestampMap(
  sourcecredDirectory: string,
  repoId: RepoId
): TimestampMap {
  const contents = fs.readFileSync(filepath(sourcecredDirectory, repoId));
  return MapUtil.fromObject(JSON.parse(contents.toString()));
}
