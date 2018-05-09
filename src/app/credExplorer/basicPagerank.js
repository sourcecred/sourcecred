// @flow

import * as tf from "@tensorflow/tfjs-core";

import type {Address} from "../../core/address";
import {AddressMap} from "../../core/address";
import {Graph} from "../../core/graph";

export type PagerankResult = AddressMap<{|
  +address: Address,
  +probability: number,
|}>;

export default function basicPagerank(graph: Graph<any, any>): PagerankResult {
  return tf.tidy(() => {
    const {nodes, markovChain} = graphToMarkovChain(graph);
    const stationaryDistribution = findStationaryDistribution(markovChain);
    const stationaryDistributionRaw = stationaryDistribution.dataSync();
    const result = new AddressMap();
    nodes.forEach((node, i) => {
      result.add({
        address: node.address,
        probability: stationaryDistributionRaw[i],
      });
    });
    return result;
  });
}

function graphToMarkovChain(graph: Graph<any, any>) {
  const nodes = graph.nodes(); // for canonical ordering
  const addressToIndex = new AddressMap();
  nodes.forEach(({address}, index) => {
    addressToIndex.add({address, index});
  });
  const buffer = tf.buffer([nodes.length, nodes.length]);
  graph.edges().forEach(({src, dst, address}) => {
    if (graph.node(src) == null) {
      console.warn("Edge has dangling src:", address, src);
      return;
    }
    if (graph.node(dst) == null) {
      console.warn("Edge has dangling dst:", address, dst);
      return;
    }
    const u = addressToIndex.get(src).index;
    const v = addressToIndex.get(dst).index;
    buffer.set(1, u, v);
    buffer.set(1, v, u);
  });
  return {
    nodes,
    markovChain: tf.tidy(() => {
      const dampingFactor = 1e-4;
      const raw = buffer.toTensor();
      const nonsingular = raw.add(tf.scalar(1e-9));
      const normalized = nonsingular.div(nonsingular.sum(1));
      const damped = tf.add(
        normalized.mul(tf.scalar(1 - dampingFactor)),
        tf.onesLike(normalized).mul(tf.scalar(dampingFactor / nodes.length))
      );
      return damped;
    }),
  };
}

function findStationaryDistribution(markovChain: $Call<tf.tensor2d>) {
  const n = markovChain.shape[0];
  if (markovChain.shape.length !== 2 || markovChain.shape[1] !== n) {
    throw new Error(`Expected square matrix; got: ${markovChain.shape}`);
  }
  let r0 = tf.tidy(() => tf.ones([n, 1]).div(tf.scalar(n)));
  function computeDelta(pi0, pi1) {
    return tf.tidy(() => tf.max(tf.abs(pi0.sub(pi1))).dataSync()[0]);
  }
  let iteration = 0;
  while (true) {
    iteration++;
    const r1 = tf.matMul(markovChain, r0);
    const delta = computeDelta(r0, r1);
    r0.dispose();
    r0 = r1;
    console.log(`[${iteration}] delta = ${delta}`);
    if (delta < 1e-7) {
      console.log(`[${iteration}] CONVERGED`);
      return r0;
    }
    if (iteration >= 255) {
      console.log(`[${iteration}] FAILED to converge`);
      return r0;
    }
  }
  // ESLint knows that this next line is unreachable, but Flow doesn't. :-)
  // eslint-disable-next-line no-unreachable
  throw new Error("Unreachable.");
}
