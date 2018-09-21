// @flow

import {Graph, type NodeAddressT, type EdgeAddressT} from "../../core/graph";
import {NodeTrie, EdgeTrie} from "../../core/trie";
import type {Assets} from "../assets";
import type {RepoId} from "../../core/repoId";

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

  constructor(adapters: $ReadOnlyArray<StaticPluginAdapter>): void {
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
    return this._adapterNodeTrie.getLast(x);
  }

  adapterMatchingEdge(x: EdgeAddressT): StaticPluginAdapter {
    return this._adapterEdgeTrie.getLast(x);
  }

  typeMatchingNode(x: NodeAddressT): NodeType {
    return this._typeNodeTrie.getLast(x);
  }

  typeMatchingEdge(x: EdgeAddressT): EdgeType {
    return this._typeEdgeTrie.getLast(x);
  }

  load(assets: Assets, repoId: RepoId): Promise<DynamicAdapterSet> {
    return Promise.all(this._adapters.map((a) => a.load(assets, repoId))).then(
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
  ): void {
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
    return this._adapterNodeTrie.getLast(x);
  }

  adapterMatchingEdge(x: EdgeAddressT): DynamicPluginAdapter {
    return this._adapterEdgeTrie.getLast(x);
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
