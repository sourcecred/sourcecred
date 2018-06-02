// @flow

import type {Address} from "./address";
import {DelegateNodeReference} from "./graph";
import type {NodeReference, NodePayload, PluginHandler} from "./graph";

export type NodeType = "FOO" | "BAR";
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

export class Handler implements PluginHandler<NodeReference, NodePayload> {
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

  pluginName() {
    return EXAMPLE_PLUGIN_NAME;
  }
}
