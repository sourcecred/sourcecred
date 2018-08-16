// @flow

import {Graph, NodeAddress, EdgeAddress} from "../../../core/graph";

import {StaticAdapterSet, DynamicAdapterSet} from "../../adapters/adapterSet";
import type {DynamicPluginAdapter} from "../../adapters/pluginAdapter";
import {pagerank} from "../../../core/attribution/pagerank";

export const COLUMNS = () => ["Description", "", "Cred"];

export async function example() {
  const graph = new Graph();
  const nodes = {
    fooAlpha: NodeAddress.fromParts(["foo", "a", "1"]),
    fooBeta: NodeAddress.fromParts(["foo", "b", "2"]),
    bar1: NodeAddress.fromParts(["bar", "a", "1"]),
    bar2: NodeAddress.fromParts(["bar", "2"]),
    xox: NodeAddress.fromParts(["xox"]),
    empty: NodeAddress.empty,
  };
  Object.values(nodes).forEach((n) => graph.addNode((n: any)));

  function addEdge(parts, src, dst) {
    const edge = {address: EdgeAddress.fromParts(parts), src, dst};
    graph.addEdge(edge);
    return edge;
  }

  const edges = {
    fooA: addEdge(["foo", "a"], nodes.fooAlpha, nodes.fooBeta),
    fooB: addEdge(["foo", "b"], nodes.fooAlpha, nodes.bar1),
    fooC: addEdge(["foo", "c"], nodes.fooAlpha, nodes.xox),
    barD: addEdge(["bar", "d"], nodes.bar1, nodes.bar1),
    barE: addEdge(["bar", "e"], nodes.bar1, nodes.xox),
    barF: addEdge(["bar", "f"], nodes.bar1, nodes.xox),
  };

  const dynamicAdapters: DynamicPluginAdapter[] = [
    {
      static: () => ({
        name: () => "foo",
        nodePrefix: () => NodeAddress.fromParts(["foo"]),
        edgePrefix: () => EdgeAddress.fromParts(["foo"]),
        nodeTypes: () => [
          {
            pluralName: "alphas",
            name: "alpha",
            prefix: NodeAddress.fromParts(["foo", "a"]),
            defaultWeight: 1,
          },
          {
            pluralName: "betas",
            name: "beta",
            prefix: NodeAddress.fromParts(["foo", "b"]),
            defaultWeight: 1,
          },
        ],
        edgeTypes: () => [
          {
            prefix: EdgeAddress.fromParts(["foo"]),
            forwardName: "foos",
            backwardName: "is fooed by",
          },
        ],
        load: (_unused_repo) => {
          throw new Error("unused");
        },
      }),
      graph: () => {
        throw new Error("unused");
      },
      nodeDescription: (x) => `foo: ${NodeAddress.toString(x)}`,
    },
    {
      static: () => ({
        name: () => "bar",
        nodePrefix: () => NodeAddress.fromParts(["bar"]),
        edgePrefix: () => EdgeAddress.fromParts(["bar"]),
        nodeTypes: () => [
          {
            name: "alpha",
            pluralName: "alphas",
            prefix: NodeAddress.fromParts(["bar", "a"]),
            defaultWeight: 1,
          },
        ],
        edgeTypes: () => [
          {
            prefix: EdgeAddress.fromParts(["bar"]),
            forwardName: "bars",
            backwardName: "is barred by",
          },
        ],
        load: (_unused_repo) => {
          throw new Error("unused");
        },
      }),
      graph: () => {
        throw new Error("unused");
      },
      nodeDescription: (x) => `bar: ${NodeAddress.toString(x)}`,
    },
    {
      static: () => ({
        name: () => "xox",
        nodePrefix: () => NodeAddress.fromParts(["xox"]),
        edgePrefix: () => EdgeAddress.fromParts(["xox"]),
        nodeTypes: () => [],
        edgeTypes: () => [],
        load: (_unused_repo) => {
          throw new Error("unused");
        },
      }),
      graph: () => {
        throw new Error("unused");
      },
      nodeDescription: (_unused_arg) => `xox node!`,
    },
    {
      static: () => ({
        nodePrefix: () => NodeAddress.fromParts(["unused"]),
        edgePrefix: () => EdgeAddress.fromParts(["unused"]),
        nodeTypes: () => [],
        edgeTypes: () => [],
        name: () => "unused",
        load: (_unused_repo) => {
          throw new Error("unused");
        },
      }),
      graph: () => {
        throw new Error("unused");
      },
      nodeDescription: () => {
        throw new Error("Unused");
      },
    },
  ];

  const staticAdapters = dynamicAdapters.map((x) => x.static());
  const adapters = new DynamicAdapterSet(
    new StaticAdapterSet(staticAdapters),
    dynamicAdapters
  );

  const pnd = await pagerank(graph, (_unused_Edge) => ({
    toWeight: 1,
    froWeight: 1,
  }));

  return {adapters, nodes, edges, graph, pnd};
}
