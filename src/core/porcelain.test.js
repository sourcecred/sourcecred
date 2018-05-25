// @flow

import {NodePorcelain, NodeReference} from "./porcelain";
import * as demoData from "./graphDemoData";

function exampleStuff() {
  const graph = demoData.mealGraph();
  const heroNode = demoData.heroNode();
  const heroReference = new NodeReference(graph, heroNode.address);
  const heroPorcelain = new NodePorcelain(heroReference, heroNode);
  const fakeAddress = demoData.makeAddress(
    "I do not exist",
    "minion of Magnificent Foo Plugin"
  );
  const fakeReference = new NodeReference(graph, fakeAddress);
  return {
    graph,
    heroNode,
    heroReference,
    heroPorcelain,
    fakeAddress,
    fakeReference,
  };
}

describe("NodeReference", () => {
  it("can retrieve graph", () => {
    const {graph, heroReference, fakeReference} = exampleStuff();
    expect(heroReference.graph()).toBe(graph);
    expect(fakeReference.graph()).toBe(graph);
  });

  it("can retrieve address", () => {
    const {
      heroReference,
      fakeReference,
      fakeAddress,
      heroNode,
    } = exampleStuff();
    expect(heroReference.address()).toEqual(heroNode.address);
    expect(fakeReference.address()).toEqual(fakeAddress);
  });

  it("can retrieve type", () => {
    const {
      heroReference,
      fakeReference,
      fakeAddress,
      heroNode,
    } = exampleStuff();
    expect(heroReference.type()).toBe(heroNode.address.type);
    expect(fakeReference.type()).toBe(fakeAddress.type);
  });

  it("can retrieve porcelain", () => {
    const {heroReference, heroPorcelain, fakeReference} = exampleStuff();
    expect(heroReference.get()).toEqual(heroPorcelain);
    expect(fakeReference.get()).toEqual(undefined);
  });

  it("can retrieve neighbors", () => {
    const {heroReference, fakeReference, graph} = exampleStuff();
    expect(
      heroReference
        .neighbors()
        .map(({edge, ref}) => ({edge, neighbor: ref.address()}))
    ).toEqual(graph.neighborhood(heroReference.address()));
    expect(fakeReference.neighbors()).toEqual([]);
  });
});

describe("NodePorcelain", () => {
  it("can get node", () => {
    const {heroNode, heroPorcelain} = exampleStuff();
    expect(heroPorcelain.node()).toEqual(heroNode);
  });

  it("can get payload", () => {
    const {heroNode, heroPorcelain} = exampleStuff();
    expect(heroPorcelain.payload()).toEqual(heroNode.payload);
  });

  it("can get ref", () => {
    const {heroPorcelain, heroReference} = exampleStuff();
    expect(heroPorcelain.ref()).toEqual(heroReference);
  });
});
