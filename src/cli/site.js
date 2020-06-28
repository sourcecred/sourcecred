// @flow

import fs from "fs-extra";

import type {Command} from "./command";
import {join as pathJoin} from "path";

const SITE_TEMPLATE_DIR = "site-template";
const SITE_OUTPUT = "site"; // under instance dir
const SITE_SYMLINKS = ["index.html", "favicon.png", "static"];

function die(std, message) {
  std.err("fatal: " + message);
  return 1;
}

const siteCommand: Command = async (args, std) => {
  if (args.length !== 0) {
    return die(std, "usage: sourcecred site");
  }
  const siteTemplate = pathJoin(__dirname, SITE_TEMPLATE_DIR);
  await fs.copy(siteTemplate, SITE_OUTPUT, {dereference: true});
  for (const symlink of SITE_SYMLINKS) {
    await lnsf(pathJoin(SITE_OUTPUT, symlink), symlink);
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
  return fs.symlink(src, dst);
}

export default siteCommand;
