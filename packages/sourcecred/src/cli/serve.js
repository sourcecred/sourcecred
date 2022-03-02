// @flow

import type {$Response as ExpressResponse} from "express";

import type {Command} from "./command";
import {loadInstanceConfig} from "./common";
import siteCommand from "./site";
import dedent from "../util/dedent";

const fs = require("fs");
const express = require("express");

function die(std, message) {
  std.err("fatal: " + message);
  return 1;
}

const serveCommand: Command = async (args, std) => {
  const returnVal = await siteCommand([], std);
  if (returnVal !== 0) {
    return die(std, `site: SourceCred site instance failed to update`);
  }
  const basedir = process.cwd();
  // check to ensure service is running within an instance directory
  await loadInstanceConfig(basedir);

  if (args.length !== 0) {
    return die(std, "usage: sourcecred admin");
  }

  const server = express();

  // override static config to enable ledger updates
  server.get(
    "/static/server-info.json",
    (_unused_req, res: ExpressResponse) => {
      res.status(200).send({hasBackend: true});
    }
  );

  // serve the static admin site and all subdirectories
  // also enables GETing data/ledger.json
  server.use(express.static("./site"));

  // middleware that parses text request bodies for us
  server.use(express.text({limit: "50mb"}));
  // write posted ledger.json files to disk
  const createPost = (filePath) => server.post("/" + filePath, (req, res) => {
    try {
      fs.writeFileSync("./" + filePath, req.body, "utf8");
    } catch (e) {
      res.status(500).send(`error saving ledger.json file: ${e}`);
    }
    res.status(201).end();
  });
  createPost("data/ledger.json")
  createPost("sourcecred.json")

  server.listen(6006, () => {
    console.info("admin server running: navigate to http://localhost:6006");
  });
  return 0;
};

export const serveHelp: Command = async (args, std) => {
  std.out(
    dedent`\
      usage: sourcecred serve

      Serve the admin site locally

      Creates an express server that enables users to create
      grain transfers between users, and update user identities. It also shows
      the dashboards available on the publicly available static site generated
      by the instance.

      Running serve will automatically run site first, so that the version of the
      site being served matches the version of SourceCred currently being used.
      `.trimRight()
  );
  return 0;
};

export default serveCommand;
