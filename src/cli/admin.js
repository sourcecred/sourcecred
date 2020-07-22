// @flow

import type {Command} from "./command";

const fs = require("fs");
const express = require("express");

function die(std, message) {
  std.err("fatal: " + message);
  return 1;
}

const adminCommand: Command = async (args, std) => {
  if (args.length !== 0) {
    return die(std, "usage: sourcecred admin");
  }

  const server = express();

  // serve the static admin site and all subdirectories
  // also enables GETing data/ledger.json
  server.use(express.static("."));

  // middleware that parses text request bodies for us
  server.use(express.text());
  // write posted ledger.json files to disk
  server.post("/data/ledger.json", (req, res) => {
    try {
      fs.writeFileSync("./data/ledger.json", req.body, "utf8");
    } catch (e) {
      res.status(500).send(`error saving ledger.json file: ${e}`);
    }
    res.status(201).end();
  });

  server.listen(6006, () => {
    console.info("admin server running: navigate to http://localhost:6006");
  });
  return 0;
};

export default adminCommand;
