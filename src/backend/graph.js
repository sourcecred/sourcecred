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

export function idToString(id: ID) {
  if (id.pluginName.includes("$")) {
    const escaped = JSON.stringify(id.pluginName);
    throw new Error(`id.pluginName must not include "\$": ${escaped}`);
  }
  if (id.repositoryName.includes("$")) {
    const escaped = JSON.stringify(id.repositoryName);
    throw new Error(`id.repositoryName must not include "\$": ${escaped}`);
  }
  if (id.name.includes("$")) {
    const escaped = JSON.stringify(id.name);
    throw new Error(`id.name must not include "\$": ${escaped}`);
  }
  return `${id.pluginName}\$${id.repositoryName}\$${id.name}`;
}

export function stringToID(string: string) {
  const parts = string.split("$");
  if (parts.length !== 3) {
    const escaped = JSON.stringify(string);
    throw new Error(`Input should have exactly two \$s: ${escaped}`);
  }
  return {
    pluginName: parts[0],
    repositoryName: parts[1],
    name: parts[2],
  };
}
