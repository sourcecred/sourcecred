// @flow

export type ArtifactNodeID = string;
export type ArtifactNodePayload = {|
  +name: string,
|};

export type NodePayload = ArtifactNodePayload;

export type ArtifactEdgeID = {|
  +src: string,
  +dst: string,
|};
export type ArtifactEdgePayload = {|
  +weight: number, // non-negative
|};

export type EdgePayload = ArtifactEdgePayload;
