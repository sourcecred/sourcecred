// @flow

import {Graph, type NodeAddressT, type EdgeAddressT} from "../../core/graph";
import {NodeTrie, EdgeTrie} from "../../core/trie";
import type {Assets} from "../../webutil/assets";
import type {RepoId} from "../../core/repoId";

import type {StaticAppAdapter, DynamicAppAdapter} from "./appAdapter";
import type {EdgeType, NodeType} from "../../analysis/types";

import {FallbackStaticAdapter} from "./fallbackAdapter";

export class StaticAdapterSet {
  _adapters: $ReadOnlyArray<StaticAppAdapter>;
  _adapterNodeTrie: NodeTrie<StaticAppAdapter>;
  _adapterEdgeTrie: EdgeTrie<StaticAppAdapter>;
  _typeNodeTrie: NodeTrie<NodeType>;
  _typeEdgeTrie: EdgeTrie<EdgeType>;

  constructor(adapters: $ReadOnlyArray<StaticAppAdapter>): void {
    this._adapters = [new FallbackStaticAdapter(), ...adapters];
    this._adapterNodeTrie = new NodeTrie();
    this._adapterEdgeTrie = new EdgeTrie();
    this._typeNodeTrie = new NodeTrie();
    this._typeEdgeTrie = new EdgeTrie();
    const usedPluginNames = new Set();
    this._adapters.forEach((a) => {
      const name = a.declaration().name;
      if (usedPluginNames.has(name)) {
        throw new Error(`Multiple plugins with name "${name}"`);
      }
      usedPluginNames.add(name);
      this._adapterNodeTrie.add(a.declaration().nodePrefix, a);
      this._adapterEdgeTrie.add(a.declaration().edgePrefix, a);
    });
    this.nodeTypes().forEach((t) => this._typeNodeTrie.add(t.prefix, t));
    this.edgeTypes().forEach((t) => this._typeEdgeTrie.add(t.prefix, t));
  }

  adapters(): $ReadOnlyArray<StaticAppAdapter> {
    return this._adapters;
  }

  nodeTypes(): NodeType[] {
    return [].concat(...this._adapters.map((x) => x.declaration().nodeTypes));
  }

  edgeTypes(): EdgeType[] {
    return [].concat(...this._adapters.map((x) => x.declaration().edgeTypes));
  }

  adapterMatchingNode(x: NodeAddressT): StaticAppAdapter {
    return this._adapterNodeTrie.getLast(x);
  }

  adapterMatchingEdge(x: EdgeAddressT): StaticAppAdapter {
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
  _adapters: $ReadOnlyArray<DynamicAppAdapter>;
  _staticAdapterSet: StaticAdapterSet;
  _adapterNodeTrie: NodeTrie<DynamicAppAdapter>;
  _adapterEdgeTrie: EdgeTrie<DynamicAppAdapter>;

  constructor(
    staticAdapterSet: StaticAdapterSet,
    adapters: $ReadOnlyArray<DynamicAppAdapter>
  ): void {
    this._staticAdapterSet = staticAdapterSet;
    this._adapters = adapters;
    this._adapterNodeTrie = new NodeTrie();
    this._adapterEdgeTrie = new EdgeTrie();
    this._adapters.forEach((a) => {
      this._adapterNodeTrie.add(a.static().declaration().nodePrefix, a);
      this._adapterEdgeTrie.add(a.static().declaration().edgePrefix, a);
    });
  }

  adapterMatchingNode(x: NodeAddressT): DynamicAppAdapter {
    return this._adapterNodeTrie.getLast(x);
  }

  adapterMatchingEdge(x: EdgeAddressT): DynamicAppAdapter {
    return this._adapterEdgeTrie.getLast(x);
  }

  adapters(): $ReadOnlyArray<DynamicAppAdapter> {
    return this._adapters;
  }

  graph(): Graph {
    return Graph.merge(this._adapters.map((x) => x.graph()));
  }

  static() {
    return this._staticAdapterSet;
  }
}
