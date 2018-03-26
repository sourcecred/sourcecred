// @flow
// This module provides some small demo graphs, which report
// on a hero's adventures in cooking a seafood fruit mix.
// It is factored as its own module so that it may be depended on by
// multiple test and demo consumers.

import type {Address} from "./address";
import {Graph} from "./graph";

export function makeAddress(id: string): Address {
  return {
    repositoryName: "sourcecred/eventide",
    pluginName: "hill_cooking_pot",
    type: "demoType",
    id,
  };
}
export const heroNode = () => ({
  address: makeAddress("hero_of_time#0"),
  payload: {},
});
export const bananasNode = () => ({
  address: makeAddress("mighty_bananas#1"),
  payload: {},
});
export const crabNode = () => ({
  address: makeAddress("razorclaw_crab#2"),
  payload: {},
});
export const mealNode = () => ({
  address: makeAddress("seafood_fruit_mix#3"),
  payload: {
    effect: ["attack_power", 1],
  },
});
export const pickEdge = () => ({
  address: makeAddress("hero_of_time#0@picks@mighty_bananas#1"),
  src: bananasNode().address,
  dst: heroNode().address,
  payload: {},
});
export const grabEdge = () => ({
  address: makeAddress("hero_of_time#0@grabs@razorclaw_crab#2"),
  src: crabNode().address,
  dst: heroNode().address,
  payload: {},
});
export const cookEdge = () => ({
  address: makeAddress("hero_of_time#0@cooks@seafood_fruit_mix#3"),
  src: mealNode().address,
  dst: heroNode().address,
  payload: {
    crit: false,
  },
});
export const bananasIngredientEdge = () => ({
  address: makeAddress("mighty_bananas#1@included_in@seafood_fruit_mix#3"),
  src: mealNode().address,
  dst: bananasNode().address,
  payload: {},
});
export const crabIngredientEdge = () => ({
  address: makeAddress("razorclaw_crab#2@included_in@seafood_fruit_mix#3"),
  src: mealNode().address,
  dst: crabNode().address,
  payload: {},
});
export const eatEdge = () => ({
  address: makeAddress("hero_of_time#0@eats@seafood_fruit_mix#3"),
  src: heroNode().address,
  dst: mealNode().address,
  payload: {},
});
export const simpleMealGraph = () =>
  new Graph()
    .addNode(heroNode())
    .addNode(bananasNode())
    .addNode(crabNode())
    .addNode(mealNode())
    .addEdge(pickEdge())
    .addEdge(grabEdge())
    .addEdge(cookEdge())
    .addEdge(bananasIngredientEdge())
    .addEdge(crabIngredientEdge())
    .addEdge(eatEdge());

export const crabLoopEdge = () => ({
  address: makeAddress("crab-self-assessment"),
  src: crabNode().address,
  dst: crabNode().address,
  payload: {evaluation: "not effective at avoiding hero"},
});

export const duplicateCookEdge = () => ({
  address: makeAddress("hero_of_time#0@again_cooks@seafood_fruit_mix#3"),
  src: mealNode().address,
  dst: heroNode().address,
  payload: {
    crit: true,
    saveScummed: true,
  },
});

export const advancedMealGraph = () =>
  simpleMealGraph()
    .addEdge(crabLoopEdge())
    .addEdge(duplicateCookEdge());
