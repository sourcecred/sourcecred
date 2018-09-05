// @flow
"use strict";

// Do this as the first thing so that any code reading it knows the right env.
process.env.NODE_ENV = process.env.NODE_ENV || "development";
process.env.BABEL_ENV = process.env.NODE_ENV;
process.env.SOURCECRED_BACKEND = "true";

require("../src/tools/entry");

// Ensure environment variables are read.
require("../config/env");

const path = require("path");
const chalk = require("chalk");
const fs = require("fs-extra");
const tmp = require("tmp");
const webpack = require("webpack");
const config = require("../config/webpack.config.backend");
const paths = require("../config/paths");
const checkRequiredFiles = require("react-dev-utils/checkRequiredFiles");
const formatWebpackMessages = require("react-dev-utils/formatWebpackMessages");
const FileSizeReporter = require("react-dev-utils/FileSizeReporter");
const printBuildError = require("react-dev-utils/printBuildError");

// These sizes are pretty large. We'll warn for bundles exceeding them.
const WARN_AFTER_BUNDLE_GZIP_SIZE = 512 * 1024;
const WARN_AFTER_CHUNK_GZIP_SIZE = 1024 * 1024;

const outputPath = process.argv.some((s) => s === "--dry-run" || s === "-n")
  ? tmp.dirSync({unsafeCleanup: true, prefix: "sourcecred-"}).name
  : paths.backendBuild;

build().then(
  ({stats, warnings}) => {
    if (warnings.length) {
      console.log(chalk.yellow("Compiled with warnings.\n"));
      console.log(warnings.join("\n\n"));
      console.log(
        "\nSearch for the " +
          chalk.underline(chalk.yellow("keywords")) +
          " to learn more about each warning."
      );
      console.log(
        "To ignore, add " +
          chalk.cyan("// eslint-disable-next-line") +
          " to the line before.\n"
      );
    } else {
      console.log(chalk.green("Compiled successfully.\n"));
    }

    const buildFolder = path.relative(process.cwd(), outputPath);
    console.log(`Build completed; results in '${buildFolder}'.`);
  },
  (err) => {
    console.log(chalk.red("Failed to compile.\n"));
    printBuildError(err);
    process.exit(1);
  }
);

// Create the backend build
function build() {
  console.log("Building backend applications...");

  let compiler = webpack(config(outputPath));
  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err) {
        return reject(err);
      }
      const messages = formatWebpackMessages(stats.toJson({}, true));
      if (messages.errors.length) {
        // Only keep the first error. Others are often indicative
        // of the same problem, but confuse the reader with noise.
        if (messages.errors.length > 1) {
          messages.errors.length = 1;
        }
        return reject(new Error(messages.errors.join("\n\n")));
      }
      if (
        process.env.CI &&
        (typeof process.env.CI !== "string" ||
          process.env.CI.toLowerCase() !== "false") &&
        messages.warnings.length
      ) {
        console.log(
          chalk.yellow(
            "\nTreating warnings as errors because process.env.CI = true.\n" +
              "Most CI servers set it automatically.\n"
          )
        );
        return reject(new Error(messages.warnings.join("\n\n")));
      }
      return resolve({
        stats,
        warnings: messages.warnings,
      });
    });
  });
}
