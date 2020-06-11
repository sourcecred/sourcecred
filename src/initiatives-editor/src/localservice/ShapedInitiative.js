// @flow
import {
  type InitiativeFileV010,
  type InitiativeFileV020,
} from "sourcecred/src/plugins/initiatives/initiativeFile";
import {type URL} from "sourcecred/src/core/references";
type UnshapedInitiaveType = {|
  type: string,
  version: string,
|};

export type ShapedInitiativeV010 = {|
  id: number,
  type: string,
  version: string,
  title: string,
  timestampIso: string,
  incompleteWeight: number,
  completeWeight: number,
  completed: boolean,
  champions: ?$ReadOnlyArray<URL>,
  dependencies: ?$ReadOnlyArray<URL>,
  references: ?$ReadOnlyArray<URL>,
  contributions: ?$ReadOnlyArray<URL>,
|};

export type ShapedInitiativeV020 = {|
  id: number,
  type: string,
  version: string,
  title: string,
  timestampIso: string,
  incompleteWeight: number,
  completeWeight: number,
  completed: boolean,
  champions: ?$ReadOnlyArray<URL>,
  dependenciesId: ?$ReadOnlyArray<string>,
  dependenciesUrl: ?$ReadOnlyArray<URL>,
  referencesId: ?$ReadOnlyArray<string>,
  referencesUrl: ?$ReadOnlyArray<URL>,
  contributionsId: ?$ReadOnlyArray<string>,
  contributionsUrl: ?$ReadOnlyArray<URL>,
|};

export type UnshapedInitiativeV1 = [UnshapedInitiaveType, InitiativeFileV010];
export type UnshapedInitiativeV2 = [UnshapedInitiaveType, InitiativeFileV020];
export type UnshapedInitiative = [
  UnshapedInitiaveType,
  InitiativeFileV010 | InitiativeFileV020
];
