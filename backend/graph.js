// @flow

export type ID = {
  pluginName: string,
  repositoryName: string,
  name: string,
};

export type GraphNode<T> = {
  id: ID,
  edges: ID[],
  payload: T,
};

export type GraphEdge<T> = {
  id: ID,
  sourceId: ID,
  destId: ID,
  weight: number,
  payload: T,
};

export type Graph = {
  nodes: {[stringID: string]: GraphNode<mixed>},
  edges: {[stringID: string]: GraphEdge<mixed>},
};
