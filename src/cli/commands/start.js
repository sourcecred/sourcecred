// @flow

import {Command} from "@oclif/command";
import chalk from "chalk";
import child_process from "child_process";
import express from "express";
import {choosePort} from "react-dev-utils/WebpackDevServerUtils";
import tmp from "tmp";

import {sourcecredDirectoryFlag} from "../common";

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on("unhandledRejection", (err) => {
  throw err;
});

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 4000;
const HOST = process.env.HOST || "0.0.0.0";

export default class StartCommand extends Command {
  static description = "start a web server to explore the contribution graph";

  static flags = {
    "sourcecred-directory": sourcecredDirectoryFlag(),
  };

  async run() {
    const {flags: {"sourcecred-directory": sourcecredDirectory}} = this.parse(
      StartCommand
    );
    startServer(sourcecredDirectory);
  }
}

async function startServer(sourcecredDirectory: string) {
  let server, webpack;
  function cleanup() {
    if (server && server.listening) {
      server.close();
    }
    if (webpack) {
      webpack.kill();
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

  const webpackWorkdir = tmp.dirSync({unsafeCleanup: true}).name;

  console.log(chalk.bold("Starting Express..."));
  const expressApp = createExpressApp(webpackWorkdir, sourcecredDirectory);
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
    chalk.green(`Server listening on port ${server.address().port}. `) +
      `You might want to wait for Webpack to say ${chalk.bold("[built]")}.`
  );
  console.log();

  console.log(chalk.bold("Starting Webpack..."));
  webpack = startWebpack(webpackWorkdir);
  webpack.on("exit", (code, signal) => {
    console.log(
      `${chalk.bold("Webpack exited")} with ${code} (signal: ${signal})`
    );
    cleanup();
  });
}

function createExpressApp(webpackWorkdir, sourcecredDirectory) {
  const app = express();
  app.use(express.static(webpackWorkdir));
  app.use("/__data__", express.static(sourcecredDirectory));
  return app;
}

function startWebpack(workdir: string) {
  const webpack = child_process.spawn(
    "yarn",
    [
      "--silent",
      "webpack",
      "--config",
      "./config/webpack.config.dev.js",
      "--output-path",
      workdir,
      "--watch",
    ],
    {
      env: {...process.env, NODE_ENV: "development"},
      stdio: "inherit",
    }
  );
  return webpack;
}
