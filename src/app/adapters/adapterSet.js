// @flow

import {Graph, type NodeAddressT, type EdgeAddressT} from "../../core/graph";
import {NodeTrie, EdgeTrie} from "../../core/trie";
import type {Repo} from "../../core/repo";

import type {
  StaticPluginAdapter,
  DynamicPluginAdapter,
  NodeType,
  EdgeType,
} from "./pluginAdapter";

import {FallbackStaticAdapter} from "./fallbackAdapter";

export class StaticAdapterSet {
  _adapters: $ReadOnlyArray<StaticPluginAdapter>;
  _adapterNodeTrie: NodeTrie<StaticPluginAdapter>;
  _adapterEdgeTrie: EdgeTrie<StaticPluginAdapter>;
  _typeNodeTrie: NodeTrie<NodeType>;
  _typeEdgeTrie: EdgeTrie<EdgeType>;

  constructor(adapters: $ReadOnlyArray<StaticPluginAdapter>) {
    this._adapters = [new FallbackStaticAdapter(), ...adapters];
    this._adapterNodeTrie = new NodeTrie();
    this._adapterEdgeTrie = new EdgeTrie();
    this._typeNodeTrie = new NodeTrie();
    this._typeEdgeTrie = new EdgeTrie();
    const usedPluginNames = new Set();
    this._adapters.forEach((a) => {
      const name = a.name();
      if (usedPluginNames.has(name)) {
        throw new Error(`Multiple plugins with name "${name}"`);
      }
      usedPluginNames.add(name);
      this._adapterNodeTrie.add(a.nodePrefix(), a);
      this._adapterEdgeTrie.add(a.edgePrefix(), a);
    });
    this.nodeTypes().forEach((t) => this._typeNodeTrie.add(t.prefix, t));
    this.edgeTypes().forEach((t) => this._typeEdgeTrie.add(t.prefix, t));
  }

  adapters(): $ReadOnlyArray<StaticPluginAdapter> {
    return this._adapters;
  }

  nodeTypes(): NodeType[] {
    return [].concat(...this._adapters.map((x) => x.nodeTypes()));
  }

  edgeTypes(): EdgeType[] {
    return [].concat(...this._adapters.map((x) => x.edgeTypes()));
  }

  adapterMatchingNode(x: NodeAddressT): StaticPluginAdapter {
    const adapters = this._adapterNodeTrie.get(x);
    if (adapters.length === 0) {
      throw new Error(
        "Invariant violation: Fallback adapter matches all nodes"
      );
    }
    return adapters[adapters.length - 1];
  }

  adapterMatchingEdge(x: EdgeAddressT): StaticPluginAdapter {
    const adapters = this._adapterEdgeTrie.get(x);
    if (adapters.length === 0) {
      throw new Error(
        "Invariant violation: Fallback adapter matches all edges"
      );
    }
    return adapters[adapters.length - 1];
  }

  typeMatchingNode(x: NodeAddressT): NodeType {
    const types = this._typeNodeTrie.get(x);
    if (types.length === 0) {
      throw new Error(
        "Invariant violation: Fallback adapter's type matches all nodes"
      );
    }
    return types[types.length - 1];
  }

  typeMatchingEdge(x: EdgeAddressT): EdgeType {
    const types = this._typeEdgeTrie.get(x);
    if (types.length === 0) {
      throw new Error(
        "Invariant violation: Fallback adapter's type matches all edges"
      );
    }
    return types[types.length - 1];
  }

  load(repo: Repo): Promise<DynamicAdapterSet> {
    return Promise.all(this._adapters.map((a) => a.load(repo))).then(
      (adapters) => new DynamicAdapterSet(this, adapters)
    );
  }
}

export class DynamicAdapterSet {
  _adapters: $ReadOnlyArray<DynamicPluginAdapter>;
  _staticAdapterSet: StaticAdapterSet;
  _adapterNodeTrie: NodeTrie<DynamicPluginAdapter>;
  _adapterEdgeTrie: EdgeTrie<DynamicPluginAdapter>;

  constructor(
    staticAdapterSet: StaticAdapterSet,
    adapters: $ReadOnlyArray<DynamicPluginAdapter>
  ) {
    this._staticAdapterSet = staticAdapterSet;
    this._adapters = adapters;
    this._adapterNodeTrie = new NodeTrie();
    this._adapterEdgeTrie = new EdgeTrie();
    this._adapters.forEach((a) => {
      this._adapterNodeTrie.add(a.static().nodePrefix(), a);
      this._adapterEdgeTrie.add(a.static().edgePrefix(), a);
    });
  }

  adapterMatchingNode(x: NodeAddressT): DynamicPluginAdapter {
    const adapters = this._adapterNodeTrie.get(x);
    if (adapters.length === 0) {
      throw new Error(
        "Invariant violation: Fallback adapter matches all nodes"
      );
    }
    return adapters[adapters.length - 1];
  }

  adapterMatchingEdge(x: EdgeAddressT): DynamicPluginAdapter {
    const adapters = this._adapterEdgeTrie.get(x);
    if (adapters.length === 0) {
      throw new Error(
        "Invariant violation: Fallback adapter matches all edges"
      );
    }
    return adapters[adapters.length - 1];
  }

  adapters(): $ReadOnlyArray<DynamicPluginAdapter> {
    return this._adapters;
  }

  graph(): Graph {
    return Graph.merge(this._adapters.map((x) => x.graph()));
  }

  static() {
    return this._staticAdapterSet;
  }
}
