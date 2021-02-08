// @flow

import type {GraphMessage} from "../../plugins/discord/createGraph";
import type {DataStorage} from "../dataStorage";

export type StorageKey = string;
export const storageKey: StorageKey = "DiscordStorageKey";

export class DiscordDataProvider {
  _storage: DataStorage;
  constructor(storage: DataStorage) {
    this._storage = storage;
  }

  async get(): Promise<$ReadOnlyArray<GraphMessage>> {
    const blob = await this._storage.get(storageKey);
    // TODO: write a GraphMessage parser
    const messageArray: $ReadOnlyArray<GraphMessage> = JSON.parse(blob);
    return messageArray;
  }
}
