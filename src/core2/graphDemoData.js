// @flow
// This module provides some small demo graphs, which report
// on a hero's adventures in cooking a seafood fruit mix.
// It is factored as its own module so that it may be depended on by
// multiple test and demo consumers.

import type {NodeReference, NodePayload, PluginHandler} from "./graph";

import {DelegateNodeReference} from "./graph";

export const PLUGIN_NAME = "sourcecred/demo/cooking";

export class Handler implements PluginHandler<DemoReference, DemoPayload<any>> {
  createReference(ref: NodeReference) {
    switch (ref.address().owner.type) {
      case "PC":
        return new HeroReference(ref);
      case "INGREDIENT":
        return new IngredientReference(ref);
      case "MEAL":
        return new MealReference(ref);
      default:
        return new DemoReference(ref);
    }
  }

  createPayload(json: any) {
    switch (json.type) {
      case "PC":
        return new HeroPayload();
      case "INGREDIENT":
        return new IngredientPayload(json.id, json.data.name);
      case "MEAL":
        return new MealPayload(json.id, json.data.name, json.data.effects);
      default:
        return new DemoPayload(json);
    }
  }

  pluginName() {
    return PLUGIN_NAME;
  }
}

export class DemoReference extends DelegateNodeReference {
  constructor(ref: NodeReference) {
    super(ref);
  }
}

export class DemoPayload<+T> implements NodePayload {
  +_id: number;
  +_type: string;
  +_data: T;

  constructor(json: {type: string, id: number, data: T}) {
    this._id = json.id;
    this._type = json.type;
    this._data = json.data;
  }

  address() {
    return {
      owner: {plugin: PLUGIN_NAME, type: this._type},
      id: String(this._id),
    };
  }

  toJSON() {
    return {type: this._type, id: this._id, data: this._data};
  }
}

export class HeroReference extends DemoReference {
  constructor(ref: NodeReference) {
    super(ref);
  }
}
export class HeroPayload extends DemoPayload<{}> {
  // The chef that sears the darkness
  constructor() {
    super({id: 0, type: "PC", data: {}});
  }
}

export class IngredientReference extends DemoReference {
  constructor(ref: NodeReference) {
    super(ref);
  }
}
export class IngredientPayload extends DemoPayload<{|+name: string|}> {
  constructor(id: number, name: string) {
    super({id, type: "INGREDIENT", data: {name}});
  }
}

export class MealReference extends DemoReference {
  constructor(ref: NodeReference) {
    super(ref);
  }
}
export class MealPayload extends DemoPayload<{|
  +name: string,
  +effects: ?[string, number],
|}> {
  constructor(id: number, name: string, effects?: [string, number]) {
    super({id, type: "MEAL", data: {name, effects}});
  }
}

export const plugins = () => [new Handler()];
