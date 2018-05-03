// @flow

import type {Address} from "../../core/address";
import type {EdgeType, NodeType} from "./types";
import {COMMIT_NODE_TYPE, GIT_PLUGIN_NAME} from "./types";

export function _makeAddress(type: NodeType | EdgeType, id: string): Address {
  return {
    pluginName: GIT_PLUGIN_NAME,
    type,
    id,
  };
}

export function commitAddress(hash: string): Address {
  return _makeAddress(COMMIT_NODE_TYPE, hash);
}
