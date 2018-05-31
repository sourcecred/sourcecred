// @flow

import stringify from "json-stable-stringify";

import type {Address} from "./address";
import {DelegateNodeReference} from "./graph";
import type {NodeReference, NodePayload, Edge, PluginHandler} from "./graph";

export type NodeType = "FOO" | "BAR";
export type EdgeType = "SIMPLE" | "STRANGE";
export const EXAMPLE_PLUGIN_NAME = "sourcecred/graph-demo-plugin";

export class FooPayload implements NodePayload {
  address() {
    // There is only ever one Foo
    return {owner: {plugin: EXAMPLE_PLUGIN_NAME, type: "FOO"}, id: ""};
  }

  toJSON() {
    return {type: "FOO"};
  }
}

export class BarPayload implements NodePayload {
  _id: number;
  _catchphrase: string;
  constructor(id: number, catchphrase: string) {
    this._id = id;
    this._catchphrase = catchphrase;
  }

  address(): Address {
    return {
      owner: {plugin: EXAMPLE_PLUGIN_NAME, type: "BAR"},
      id: this._id.toString(),
    };
  }

  id(): number {
    return this._id;
  }

  catchphrase(): string {
    return this._catchphrase;
  }

  toJSON() {
    return {type: "BAR", id: this._id, catchphrase: this._catchphrase};
  }
}

export class FooReference extends DelegateNodeReference {
  constructor(ref: NodeReference) {
    super(ref);
  }

  // Return the number of adjacent BarNodes
  numberOfBars(): number {
    throw new Error("Requires neighborhood to be implemented first");
  }
}

export class BarReference extends DelegateNodeReference {
  constructor(ref: NodeReference) {
    super(ref);
  }
}

export class SimpleEdge implements Edge {
  _src: NodeReference;
  _dst: NodeReference;

  constructor(src: NodeReference, dst: NodeReference) {
    this._src = src;
    this._dst = dst;
  }
  src(): NodeReference {
    return this._src;
  }
  dst(): NodeReference {
    return this._dst;
  }
  address(): Address {
    const srcFragment = stringify(this.src().address());
    const dstFragment = stringify(this.dst().address());
    const id = `SIMPLE:${srcFragment}-${dstFragment}`;
    return {owner: {plugin: EXAMPLE_PLUGIN_NAME, type: "SIMPLE"}, id};
  }
  toJSON() {
    return {type: "SIMPLE"};
  }
}

export class StrangeEdge implements Edge {
  _src: NodeReference;
  _dst: NodeReference;
  _strangeness: number;
  _name: string;

  constructor(
    src: NodeReference,
    dst: NodeReference,
    name: string,
    strangeness: number
  ) {
    this._src = src;
    this._dst = dst;
    this._name = name;
    this._strangeness = strangeness;
  }
  src(): NodeReference {
    return this._src;
  }
  dst(): NodeReference {
    return this._dst;
  }
  strangeness(): number {
    return this._strangeness;
  }
  name(): string {
    return this._name;
  }
  address(): Address {
    return {
      owner: {plugin: EXAMPLE_PLUGIN_NAME, type: "STRANGE"},
      id: this._name,
    };
  }
  toJSON() {
    return {type: "STRANGE", name: this._name, strangeness: this._strangeness};
  }
}

export class Handler
  implements PluginHandler<
      NodeReference,
      NodePayload,
      SimpleEdge | StrangeEdge
    > {
  createReference(ref: NodeReference) {
    const type: NodeType = (ref.address().owner.type: any);
    switch (type) {
      case "FOO":
        return new FooReference(ref);
      case "BAR":
        return new BarReference(ref);
      default:
        // eslint-disable-next-line no-unused-expressions
        (type: empty);
        throw new Error(`Unexpected NodeType: ${type}`);
    }
  }

  createPayload(json: any) {
    const type: NodeType = json.type;
    switch (type) {
      case "FOO":
        return new FooPayload();
      case "BAR":
        return new BarPayload(json.id, json.catchphrase);
      default:
        // eslint-disable-next-line no-unused-expressions
        (type: empty);
        throw new Error(`Unexpected NodeType: ${type}`);
    }
  }

  createEdge(src: NodeReference, dst: NodeReference, json: any) {
    const type: EdgeType = json.type;
    switch (type) {
      case "SIMPLE":
        return new SimpleEdge(src, dst);
      case "STRANGE":
        return new StrangeEdge(src, dst, json.name, json.strangeness);
      default:
        // eslint-disable-next-line no-unused-expressions
        (type: empty);
        throw new Error(`Unexpected EdgeType: ${type}`);
    }
  }

  pluginName() {
    return EXAMPLE_PLUGIN_NAME;
  }
}
