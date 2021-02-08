// @flow
import type {DataStorage, WritableDataStorage} from "./dataStorage";
import {join} from "path";
import fs from "fs-extra";
export type DiskStorageOptions = {};

// warning: possible path traversal attack: please @wchargin for review
export class DiskStorage implements DataStorage, WritableDataStorage {
  _path: string;
  constructor(path: string) {
    this._path = path;
  }

  async get(key: string): Promise<string> {
    // convert path to file object
    const filePath = join(this._path, key);

    const res = await fs.readFile(filePath);

    return res.toString();
  }

  async set(key: string, value: string): Promise<void> {
    const filePath = join(this._path, key);

    await fs.writeFile(filePath, value);
  }
}
