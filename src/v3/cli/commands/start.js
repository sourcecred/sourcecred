// @flow

import {Command} from "@oclif/command";
import chalk from "chalk";
import fs from "fs";
import {choosePort} from "react-dev-utils/WebpackDevServerUtils";

import apiApp from "../../../v3/app/apiApp";
import {sourcecredDirectoryFlag} from "../common";

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 4000;
const HOST = process.env.HOST || "0.0.0.0";

export default class StartCommand extends Command {
  static description = "start a web server to explore the contribution graph";

  static flags = {
    "sourcecred-directory": sourcecredDirectoryFlag(),
  };

  async run() {
    const {
      flags: {"sourcecred-directory": sourcecredDirectory},
    } = this.parse(StartCommand);
    startServer(sourcecredDirectory);
  }
}

async function startServer(sourcecredDirectory: string) {
  let server;
  function cleanup() {
    if (server && server.listening) {
      server.close();
    }
  }

  let shuttingDown = false;
  ["SIGINT", "SIGTERM"].forEach((signal) => {
    process.on(signal, () => {
      if (shuttingDown) {
        // Force shut-down.
        process.exit(2);
      } else {
        shuttingDown = true;
        console.log("\nShutting down.");
        cleanup();
      }
    });
  });

  const staticFiles = "./build/";
  if (!fs.existsSync(staticFiles)) {
    console.error("Build output not found. Did you run `yarn build`?");
  }

  console.log(chalk.bold("Starting Express..."));
  const expressApp = apiApp(sourcecredDirectory, staticFiles);
  server = await new Promise(async (resolve, _unused_reject) => {
    const port = await choosePort(HOST, DEFAULT_PORT);
    let server = expressApp.listen(port, () => {
      resolve(server);
    });
  });
  server.on("close", () => {
    console.log(chalk.bold("Express server closed."));
    cleanup();
  });
  console.log(
    chalk.green(`Server listening on port ${server.address().port}.`)
  );
  console.log();
}
