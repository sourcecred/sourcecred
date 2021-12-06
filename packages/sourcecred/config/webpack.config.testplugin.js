// @flow

// Do this as the first thing so that any code reading it knows the right env.
process.env.NODE_ENV = process.env.NODE_ENV || "development";
process.env.BABEL_ENV = process.env.NODE_ENV;

const webpack = require("webpack");
const RemoveBuildDirectoryPlugin = require("./RemoveBuildDirectoryPlugin");
const paths = require("./paths");
const getClientEnvironment = require("./env");

const env = getClientEnvironment(null);

const config = {
  bail: true,
  target: "node",
  node: {
    __dirname: false,
    __filename: false,
  },
  entry: {
    api: paths.testEntryPoints.packagePlugin,
  },
  output: {
    path: paths.testOutputPaths.packagePlugin,
    libraryTarget: "umd",
    // Generated JS file names (with nested folders).
    // There will be one main bundle, and one file per asynchronous chunk.
    // We don't currently advertise code splitting but Webpack supports it.
    filename: "[name].js",
    chunkFilename: "[name].[chunkhash:8].chunk.js",
    libraryExport: "default",
    // Use `this` for compatibility with both Node and browser.
    globalObject: "this",
  },
  resolve: {
    extensions: [".js", ".json"],
  },
  module: {
    strictExportPresence: true,
    rules: [
      {
        // "oneOf" will traverse all following loaders until one will
        // match the requirements. If no loader matches, it will fail.
        oneOf: [
          // Process JS with Babel.
          {
            test: /\.(js|jsx|mjs)$/,
            include: paths.appSrc,
            loader: require.resolve("babel-loader"),
            options: {
              compact: true,
            },
          },
        ],
      },
    ],
  },
  plugins: [
    new RemoveBuildDirectoryPlugin(),
    new webpack.DefinePlugin(env.individuallyStringified),
  ],
  mode: process.env.NODE_ENV,
};
module.exports = ([config] /*: Array<any>*/);
