// @flow

import {markovProcessGraph, credGraph} from "./testUtils";

describe("core/credrank/credGraph", () => {
  describe("basic behavior", () => {
    it("has a Cred node for every mpg node", async () => {
      const mpg = markovProcessGraph();
      const cg = await credGraph();
      const mpgNodes = Array.from(mpg.nodes());
      const expectedNodes = mpgNodes.map((n) => ({
        ...n,
        cred: expect.anything(),
      }));
      expect(Array.from(cg.nodes())).toEqual(expectedNodes);
    });
    it("has a Cred edge for every mpg edge", async () => {
      const mpg = markovProcessGraph();
      const cg = await credGraph();
      const mpgEdges = Array.from(mpg.edges());
      const expectedEdges = mpgEdges.map((n) => ({
        ...n,
        credFlow: expect.anything(),
      }));
      expect(Array.from(cg.edges())).toEqual(expectedEdges);
    });
    it("has every participant", async () => {
      const mpg = markovProcessGraph();
      const cg = await credGraph();
      const mpgParticipants = Array.from(mpg.participants());
      const expectedParticipants = mpgParticipants.map((p) => ({
        ...p,
        credPerEpoch: expect.anything(),
        cred: expect.anything(),
      }));
      const actualParticipants = Array.from(cg.participants());
      expect(actualParticipants).toEqual(expectedParticipants);
    });
    it("total participant Cred is equal to total minted cred", async () => {
      let totalMint = 0;
      const cg = await credGraph();
      for (const {mint} of cg.nodes()) {
        totalMint += mint;
      }
      let participantCred = 0;
      for (const {cred} of cg.participants()) {
        participantCred += cred;
      }
      expect(totalMint).toBeCloseTo(participantCred);
    });
  });
});
