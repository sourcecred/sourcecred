// @flow

import type {TimestampMs} from "../../util/timestamp";
import {fromString as uuidFromString, type Uuid} from "../../util/uuid";
import {
  NodeAddress,
  type NodeAddressT,
  EdgeAddress,
  type EdgeAddressT,
} from "../graph";
import {
  type MarkovEdge,
  type MarkovEdgeAddressT,
  type TransitionProbability,
  MarkovEdgeAddress,
  markovEdgeAddress,
} from "./markovEdge";
import {
  seedGadget,
  accumulatorGadget,
  type ParticipantEpochAddress,
  epochGadget,
} from "./nodeGadgets";
import {type IdentityId} from "../identity/id";

export interface EdgeGadget<T> {
  prefix: MarkovEdgeAddressT;
  toRaw: (T) => MarkovEdgeAddressT;
  fromRaw: (MarkovEdgeAddressT) => T;
  markovEdge: (T, TransitionProbability) => MarkovEdge;
}

type MakeSeedGadgetArgs<T> = {|
  +edgePrefix: EdgeAddressT,
  +seedIsSrc: boolean,
  +toParts: (T) => string[],
  +fromParts: (string[]) => T,
|};
/**
 * A helper function for creating a gadget only produces edges incident to seed.
 * We assume that it has a function for converting from the target type into node address parts, which will
 * be used to produce a unique edge address, and which are the address parts for the src or dst.
 * If seedIsSrc is true, then the seed is the src and the dst will be the target. Otherwise, the seed is the dst
 * and the target will be the src.
 * These markov edges are never reversed.
 */
function makeSeedGadget<T>({
  edgePrefix,
  seedIsSrc,
  toParts,
  fromParts,
}: MakeSeedGadgetArgs<T>): EdgeGadget<T> {
  const prefix = markovEdgeAddress(edgePrefix, "F");
  const prefixLength = MarkovEdgeAddress.toParts(prefix).length;
  const toRaw = (target) =>
    MarkovEdgeAddress.append(prefix, ...toParts(target));
  const fromRaw = (addr) =>
    fromParts(MarkovEdgeAddress.toParts(addr).slice(prefixLength));
  const markovEdge = (target, transitionProbability) => {
    const seed = seedGadget.prefix;
    const targetAddress = NodeAddress.fromParts(toParts(target));
    return {
      address: EdgeAddress.append(edgePrefix, ...toParts(target)),
      reversed: false,
      src: seedIsSrc ? seed : targetAddress,
      dst: seedIsSrc ? targetAddress : seed,
      transitionProbability,
    };
  };
  return Object.freeze({prefix, toRaw, fromRaw, markovEdge});
}

export const GADGET_EDGE_PREFIX: EdgeAddressT = EdgeAddress.fromParts([
  "sourcecred",
  "core",
  "gadget",
]);

export const radiationGadget: EdgeGadget<NodeAddressT> = makeSeedGadget({
  edgePrefix: EdgeAddress.append(GADGET_EDGE_PREFIX, "RADIATION"),
  seedIsSrc: false,
  toParts: (x) => NodeAddress.toParts(x),
  fromParts: (x) => NodeAddress.fromParts(x),
});

export const seedMintGadget: EdgeGadget<NodeAddressT> = makeSeedGadget({
  edgePrefix: EdgeAddress.append(GADGET_EDGE_PREFIX, "SEED_MINT"),
  seedIsSrc: true,
  toParts: (x) => NodeAddress.toParts(x),
  fromParts: (x) => NodeAddress.fromParts(x),
});

/**
 * The payout gadget creates edges that connect participant epoch nodes to the
 * epoch accumulator nodes. Each payout edge represents the flow of Cred from a
 * participant's epoch back to the seed (by means of the accumulator). Thus,
 * the Cred flow on this edge actually represents Cred score for the
 * participant. (The Cred score of the epoch node can't be seen as the user's
 * score, because some of it flows to other contributions, to other epoch
 * nodes, etc.)
 */
export const payoutGadget: EdgeGadget<ParticipantEpochAddress> = (() => {
  const edgePrefix = EdgeAddress.append(GADGET_EDGE_PREFIX, "PAYOUT");
  const prefix = markovEdgeAddress(edgePrefix, "F");
  const prefixLength = MarkovEdgeAddress.toParts(prefix).length;
  const toRaw = ({epochStart, owner}) =>
    MarkovEdgeAddress.append(prefix, String(epochStart), owner);
  const fromRaw = (addr) => {
    const parts = MarkovEdgeAddress.toParts(addr).slice(prefixLength);
    const epochStart = +parts[0];
    const owner = uuidFromString(parts[1]);
    return {epochStart, owner};
  };
  const markovEdge = ({owner, epochStart}, transitionProbability) => ({
    address: EdgeAddress.append(edgePrefix, String(epochStart), owner),
    reversed: false,
    src: epochGadget.toRaw({owner, epochStart}),
    dst: accumulatorGadget.toRaw({epochStart}),
    transitionProbability,
  });
  return Object.freeze({prefix, toRaw, fromRaw, markovEdge});
})();

export type WebbingAddress = {|
  +thisStart: TimestampMs,
  +lastStart: TimestampMs,
  +owner: Uuid,
|};
const webbingEdgePrefix = EdgeAddress.append(
  GADGET_EDGE_PREFIX,
  "EPOCH_WEBBING"
);

/**
 * The forward webbing edges flow Cred forwards from participant epoch nodes to
 * the temporally next epoch node from the same participant. The intention is
 * to "smooth out" Cred over time by having some of it flow forwards in time.
 */
export const forwardWebbingGadget: EdgeGadget<WebbingAddress> = (() => {
  const prefix = markovEdgeAddress(webbingEdgePrefix, "F");
  const prefixLength = MarkovEdgeAddress.toParts(prefix).length;
  const toRaw = ({thisStart, lastStart, owner}) =>
    MarkovEdgeAddress.append(
      prefix,
      String(lastStart),
      String(thisStart),
      owner
    );
  const fromRaw = (address) => {
    const parts = MarkovEdgeAddress.toParts(address).slice(prefixLength);
    const lastStart = +parts[0];
    const thisStart = +parts[1];
    const owner = uuidFromString(parts[2]);
    return {lastStart, thisStart, owner};
  };
  const markovEdge = ({thisStart, lastStart, owner}, transitionProbability) => {
    const thisEpoch = {epochStart: thisStart, owner};
    const lastEpoch = {epochStart: lastStart, owner};
    return {
      address: EdgeAddress.append(
        webbingEdgePrefix,
        String(lastStart),
        String(thisStart),
        owner
      ),
      reversed: false,
      src: epochGadget.toRaw(lastEpoch),
      dst: epochGadget.toRaw(thisEpoch),
      transitionProbability,
    };
  };
  return {prefix, toRaw, fromRaw, markovEdge};
})();

/**
 * The backward webbing edges flow Cred backwards from participant epoch nodes
 * to the temporally previous epoch node from the same participant. The
 * intention is to "smooth out" Cred over time by having some of it flow
 * backwards in time.
 */
export const backwardWebbingGadget: EdgeGadget<WebbingAddress> = (() => {
  const prefix = markovEdgeAddress(webbingEdgePrefix, "B");
  const prefixLength = MarkovEdgeAddress.toParts(prefix).length;
  const toRaw = ({thisStart, lastStart, owner}) =>
    MarkovEdgeAddress.append(
      prefix,
      String(lastStart),
      String(thisStart),
      owner
    );
  const fromRaw = (address) => {
    const parts = MarkovEdgeAddress.toParts(address).slice(prefixLength);
    const lastStart = +parts[0];
    const thisStart = +parts[1];
    const owner = uuidFromString(parts[2]);
    return {lastStart, thisStart, owner};
  };
  const markovEdge = ({thisStart, lastStart, owner}, transitionProbability) => {
    const thisEpoch = {epochStart: thisStart, owner};
    const lastEpoch = {epochStart: lastStart, owner};
    return {
      address: EdgeAddress.append(
        webbingEdgePrefix,
        String(lastStart),
        String(thisStart),
        owner
      ),
      reversed: true,
      src: epochGadget.toRaw(thisEpoch),
      dst: epochGadget.toRaw(lastEpoch),
      transitionProbability,
    };
  };
  return {prefix, toRaw, fromRaw, markovEdge};
})();

export type PersonalAttributionAddress = {|
  +epochStart: TimestampMs,
  +fromParticipantId: IdentityId,
  +toParticipantId: IdentityId,
|};

export const personalAttributionGadget: EdgeGadget<PersonalAttributionAddress> =
  (() => {
    const edgePrefix = EdgeAddress.append(GADGET_EDGE_PREFIX, "ATTRIBUTION");
    const prefix = markovEdgeAddress(edgePrefix, "F");
    const prefixLength = MarkovEdgeAddress.toParts(prefix).length;
    const toRaw = ({epochStart, fromParticipantId, toParticipantId}) =>
      MarkovEdgeAddress.append(
        prefix,
        String(epochStart),
        fromParticipantId,
        toParticipantId
      );
    const fromRaw = (addr) => {
      const parts = MarkovEdgeAddress.toParts(addr).slice(prefixLength);
      const epochStart = +parts[0];
      const fromParticipantId = uuidFromString(parts[1]);
      const toParticipantId = uuidFromString(parts[2]);
      return {epochStart, fromParticipantId, toParticipantId};
    };
    const markovEdge = (
      {epochStart, fromParticipantId, toParticipantId},
      transitionProbability
    ) => ({
      address: EdgeAddress.append(
        edgePrefix,
        String(epochStart),
        fromParticipantId,
        toParticipantId
      ),
      reversed: false,
      src: epochGadget.toRaw({owner: fromParticipantId, epochStart}),
      dst: epochGadget.toRaw({owner: toParticipantId, epochStart}),
      transitionProbability,
    });
    return Object.freeze({prefix, toRaw, fromRaw, markovEdge});
  })();
