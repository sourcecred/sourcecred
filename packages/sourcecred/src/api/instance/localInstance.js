// @flow

import {mkdirx} from "../../util/disk";
import {DiskStorage} from "../../core/storage/disk";
import {WriteInstance} from "./writeInstance";

/**
This is an Instance implementation that reads and writes using relative paths
on the local disk.
 */
export class LocalInstance extends WriteInstance {
  constructor(baseDirectory: string) {
    super(new DiskStorage(baseDirectory));
  }

  //////////////////////////////
  //  Private Functions
  //////////////////////////////

  mkdir(path: string) {
    mkdirx(path);
  }
}
