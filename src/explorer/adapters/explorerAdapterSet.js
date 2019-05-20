// @flow
/**
 * This module is deprecated; logic for aggregating over different plugins,
 * and matching adapters for a particular  or edge, should live at the
 * core plugin level, not at the level of particular adapters. Otherwise,
 * we will find ourselves re-implementing the same logic repetitiously for
 * every new adapter.
 *
 * If considering adding new dependencies on this file or adding new features,
 * please consider simply re-writing it to live in the analysis module and
 * be paramterized over the adapter choice.
 */

import {Graph, type NodeAddressT, type EdgeAddressT} from "../../core/graph";
import {NodeTrie, EdgeTrie} from "../../core/trie";
import type {NodeAndEdgeTypes} from "../../analysis/types";
import {combineTypes} from "../../analysis/pluginDeclaration";
import type {Assets} from "../../webutil/assets";
import type {RepoId} from "../../core/repoId";

import type {
  StaticExplorerAdapter,
  DynamicExplorerAdapter,
} from "./explorerAdapter";
import type {EdgeType, NodeType} from "../../analysis/types";

export class StaticExplorerAdapterSet {
  _adapters: $ReadOnlyArray<StaticExplorerAdapter>;
  _adapterNodeTrie: NodeTrie<StaticExplorerAdapter>;
  _adapterEdgeTrie: EdgeTrie<StaticExplorerAdapter>;
  _typeNodeTrie: NodeTrie<NodeType>;
  _typeEdgeTrie: EdgeTrie<EdgeType>;

  constructor(adapters: $ReadOnlyArray<StaticExplorerAdapter>): void {
    this._adapters = adapters;
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

  adapters(): $ReadOnlyArray<StaticExplorerAdapter> {
    return this._adapters;
  }

  combinedTypes(): NodeAndEdgeTypes {
    return combineTypes(this._adapters.map((x) => x.declaration()));
  }

  // TODO(@decentralion): Remove the next two methods
  // (Although really I want to remove this whole class.)
  nodeTypes(): NodeType[] {
    return [].concat(...this._adapters.map((x) => x.declaration().nodeTypes));
  }

  edgeTypes(): EdgeType[] {
    return [].concat(...this._adapters.map((x) => x.declaration().edgeTypes));
  }

  adapterMatchingNode(x: NodeAddressT): ?StaticExplorerAdapter {
    return this._adapterNodeTrie.getLast(x);
  }

  adapterMatchingEdge(x: EdgeAddressT): ?StaticExplorerAdapter {
    return this._adapterEdgeTrie.getLast(x);
  }

  typeMatchingNode(x: NodeAddressT): ?NodeType {
    return this._typeNodeTrie.getLast(x);
  }

  typeMatchingEdge(x: EdgeAddressT): ?EdgeType {
    return this._typeEdgeTrie.getLast(x);
  }

  load(assets: Assets, repoId: RepoId): Promise<DynamicExplorerAdapterSet> {
    return Promise.all(this._adapters.map((a) => a.load(assets, repoId))).then(
      (adapters) => new DynamicExplorerAdapterSet(this, adapters)
    );
  }
}

export class DynamicExplorerAdapterSet {
  _adapters: $ReadOnlyArray<DynamicExplorerAdapter>;
  _staticExplorerAdapterSet: StaticExplorerAdapterSet;
  _adapterNodeTrie: NodeTrie<DynamicExplorerAdapter>;
  _adapterEdgeTrie: EdgeTrie<DynamicExplorerAdapter>;

  constructor(
    staticExplorerAdapterSet: StaticExplorerAdapterSet,
    adapters: $ReadOnlyArray<DynamicExplorerAdapter>
  ): void {
    this._staticExplorerAdapterSet = staticExplorerAdapterSet;
    this._adapters = adapters;
    this._adapterNodeTrie = new NodeTrie();
    this._adapterEdgeTrie = new EdgeTrie();
    this._adapters.forEach((a) => {
      this._adapterNodeTrie.add(a.static().declaration().nodePrefix, a);
      this._adapterEdgeTrie.add(a.static().declaration().edgePrefix, a);
    });
  }

  adapterMatchingNode(x: NodeAddressT): ?DynamicExplorerAdapter {
    return this._adapterNodeTrie.getLast(x);
  }

  adapterMatchingEdge(x: EdgeAddressT): ?DynamicExplorerAdapter {
    return this._adapterEdgeTrie.getLast(x);
  }

  adapters(): $ReadOnlyArray<DynamicExplorerAdapter> {
    return this._adapters;
  }

  graph(): Graph {
    return Graph.merge(this._adapters.map((x) => x.graph()));
  }

  static() {
    return this._staticExplorerAdapterSet;
  }
}
