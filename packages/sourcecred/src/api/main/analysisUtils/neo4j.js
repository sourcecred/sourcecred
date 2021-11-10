// @flow

import type {AnalysisInput} from "../analysis";
import {epochGadget} from "../../../core/credrank/nodeGadgets";
import {NodeAddress, EdgeAddress} from "../../../core/graph";
import {batchIterator} from "../../../util/batch";
import {parse as serializeAsCsv} from "json2csv";

/** Iterators that will yield CSV strings. The CSV contents will be batched in
groups for scalability. Each group will include headers. These strings can
each be written to disk as a .csv file and then used to export the nodes
and edges of a CredGraph into a Neo4j database using neo4j-admin.*/
export type Neo4jOutput = {|
  nodes: Iterator<string> & {iterationsCompleted: () => number},
  edges: Iterator<string> & {iterationsCompleted: () => number},
|};

// Used for batching nodes and edges.
// This is mainly mitigating against the max string length in JS,
// so hardcoding it makes sense for now.
const safeBatchSize = 500000;

export const computeNeo4jData = (input: AnalysisInput): Neo4jOutput => {
  function* nodesCsvGenerator() {
    const batchedNodes = batchIterator(input.credGraph.nodes(), safeBatchSize);
    while (batchedNodes.hasNext()) {
      const formattedNodes = [];
      for (const node of batchedNodes) {
        formattedNodes.push({
          description: getNodeDescription(node, input.ledger),
          cred: node.cred,
          mint: node.mint,
          "address:ID": reformatNodeAddress(node.address),
          "nodeType:LABEL": reformatNodeAddress(node.address, 3),
          "plugin:LABEL": reformatNodeAddress(node.address, 2),
        });
      }
      yield (serializeAsCsv(formattedNodes): string);
    }
  }

  function* edgesCsvGenerator() {
    const batchedEdges = batchIterator(input.credGraph.edges(), safeBatchSize);
    while (batchedEdges.hasNext()) {
      const formattedEdges = [];
      for (const edge of batchedEdges) {
        formattedEdges.push({
          reversed: edge.reversed,
          transitionProbability: edge.transitionProbability,
          credFlow: edge.credFlow,
          address: reformatEdgeAddress(edge.address),
          ":TYPE": reformatEdgeAddress(edge.address, 3),
          "dst:END_ID": reformatNodeAddress(edge.dst),
          "src:START_ID": reformatNodeAddress(edge.src),
        });
      }
      yield (serializeAsCsv(formattedEdges): string);
    }
  }

  return {
    nodes: generatorToCountingIterator(nodesCsvGenerator()),
    edges: generatorToCountingIterator(edgesCsvGenerator()),
  };
};

function reformatNodeAddress(address, partsToInclude = Infinity) {
  const a = NodeAddress.toParts(address).slice(0, partsToInclude);
  return a.join("/");
}

function reformatEdgeAddress(address, partsToInclude = Infinity) {
  const a = EdgeAddress.toParts(address).slice(0, partsToInclude);
  return a.join("/");
}

function getNodeDescription(node, ledger) {
  if (NodeAddress.hasPrefix(node.address, epochGadget.prefix)) {
    const {owner, epochStart} = epochGadget.fromRaw(node.address);
    return `Participant: ${
      ledger.account(owner).identity.name
    }, Epoch Start: ${new Date(epochStart).toDateString()}`;
  }
  return node.description.replace(/[^a-zA-Z0-9/:[\]() \-.#]/g, "");
}

function generatorToCountingIterator(generator) {
  let counter = 0;
  const countingGenerator = (function* () {
    let next = generator.next();
    while (!next.done) {
      counter++;
      yield next.value;
      next = generator.next();
    }
  })();
  const result = {
    iterationsCompleted: () => counter,
    next: countingGenerator.next,
    ["@@iterator"]: () => countingGenerator,
    [Symbol.iterator]: () => countingGenerator,
  };
  return result;
}
