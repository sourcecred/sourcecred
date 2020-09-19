// @flow

import fs from "fs-extra";

import type {Command} from "./command";
import {join} from "path";
import {loadInstanceConfig} from "./common";
import dedent from "../util/dedent";

const SITE_TEMPLATE_DIR = "site-template";
const SITE_OUTPUT = "site"; // under instance dir
// Targets to symlink from the instance into the site dir
const SYMLINK_TARGETS = ["sourcecred.json", "data", "config", "output"];

function die(std, message) {
  std.err("fatal: " + message);
  return 1;
}

const siteCommand: Command = async (args, std) => {
  if (args.length !== 0) {
    return die(std, "usage: sourcecred site");
  }
  const siteTemplate = join(__dirname, SITE_TEMPLATE_DIR);
  await fs.copy(siteTemplate, SITE_OUTPUT, {dereference: true});

  const instanceDir = process.cwd();
  // Will error if we aren't in a valid SourceCred instance.
  await loadInstanceConfig(instanceDir);

  // Link in all the instance data that is referenced by the site.
  for (const target of SYMLINK_TARGETS) {
    const src = join(instanceDir, target);
    const dst = join(SITE_OUTPUT, target);
    await lnsf(src, dst);
  }
  return 0;
};

// Create a symlink, overwriting if it exists, like `ln -sf`.
async function lnsf(src: string, dst: string): Promise<void> {
  try {
    await fs.symlink(src, dst);
  } catch (e) {
    if (e.code !== "EEXIST") {
      throw e;
    }
  }
  await fs.unlink(dst);
  await fs.symlink(src, dst);
}

export const siteHelp: Command = async (args, std) => {
  std.out(
    dedent`\
      usage: sourcecred site

      Update your instance site to the latest release.

      Running 'sourcecred site' will copy the latest frontend from the sourcecred 
      CLI into the current sourcecred instance.
      `.trimRight()
  );
  return 0;
};

export default siteCommand;
