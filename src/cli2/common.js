// @flow

import path from "path";
import fs from "fs-extra";

import type {InstanceConfig} from "./instanceConfig";

export async function loadInstanceConfig(): Promise<InstanceConfig | null> {
  const cwd = process.cwd();
  const projectFilePath = path.join(cwd, "sourcecred.json");
  try {
    const contents = await fs.read(projectFilePath);
    return Promise.resolve(JSON.parse(contents));
  } catch (e) {
    return Promise.resolve(null);
  }
}
