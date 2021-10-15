// @flow

import {WritableDataStorage, DataStorage} from "./index";
import {inflate, deflate} from "pako";
/**
 * The ZipStorage class composes with other WritableDataStorage implementations.
 * It compresses `value`s before passing them into the underlying `baseStorage`
 * implementation, and decompresses them upon receit  from `baseStorage`.
 */
export class ZipStorage implements DataStorage {
  +_baseStorage: DataStorage;

  constructor(baseStorage: DataStorage) {
    this._baseStorage = baseStorage;
  }

  async get(key: string): Promise<Uint8Array> {
    const data = await this._baseStorage.get(key);
    return inflate(data, {to: "Uint8Array"});
  }
}

export class WritableZipStorage
  extends ZipStorage
  implements WritableDataStorage
{
  +_baseStorage: WritableDataStorage;

  constructor(baseStorage: WritableDataStorage) {
    super(baseStorage);
    this._baseStorage = baseStorage;
  }

  async set(key: string, value: Uint8Array): Promise<void> {
    this._baseStorage.set(key, deflate(value));
  }
}
