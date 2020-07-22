// @flow

import type {Command} from "./command";

const fs = require("fs");
const path = require("path");
const jsonServer = require("json-server");
const serveStatic = require("serve-static");

function die(std, message) {
  std.err("fatal: " + message);
  return 1;
}

const adminCommand: Command = async (args, std) => {
  if (args.length !== 0) {
    return die(std, "usage: sourcecred admin");
  }
  const baseDir = process.cwd();

  const server = jsonServer.create();
  const middlewares = jsonServer.defaults();

  server.use(middlewares);

  server.listen(6006, () => {
    console.info("JSON Server is running");
  });
  return 0;
};

export default adminCommand;
