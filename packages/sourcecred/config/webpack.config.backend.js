// @flow

// Do this as the first thing so that any code reading it knows the right env.
process.env.NODE_ENV = process.env.NODE_ENV || "development";
process.env.BABEL_ENV = process.env.NODE_ENV;
process.env.SOURCECRED_BACKEND = "true";

const webpack = require("webpack");
const ModuleScopePlugin = require("react-dev-utils/ModuleScopePlugin");
const RemoveBuildDirectoryPlugin = require("./RemoveBuildDirectoryPlugin");
const paths = require("./paths");
const nodeExternals = require("webpack-node-externals");
const getClientEnvironment = require("./env");

const env = getClientEnvironment(null);

// This is the backend configuration. It builds applications that target
// Node and will not run in a browser.
module.exports = ({
  // Don't attempt to continue if there are any errors.
  bail: true,
  // Target Node instead of the browser.
  target: "node",
  node: {
    // Don't munge `__dirname` and `__filename`.
    // https://github.com/webpack/webpack/issues/1599#issuecomment-186841345
    __dirname: false,
    __filename: false,
  },
  entry: paths.backendEntryPoints,
  externals: [nodeExternals()],
  output: {
    path: paths.backendBuild,
    // Generated JS file names (with nested folders).
    // There will be one main bundle, and one file per asynchronous chunk.
    // We don't currently advertise code splitting but Webpack supports it.
    filename: "[name].js",
    chunkFilename: "[name].[chunkhash:8].chunk.js",
    libraryTarget: "umd",
  },
  resolve: {
    extensions: [".js", ".json"],
    plugins: [
      // Prevents users from importing files from outside of src/ (or node_modules/).
      // This often causes confusion because we only process files within src/ with babel.
      // To fix this, we prevent you from importing files out of src/ -- if you'd like to,
      // please link the files into your node_modules/ and let module-resolution kick in.
      // Make sure your source files are compiled, as they will not be processed in any way.
      new ModuleScopePlugin(paths.appSrc, [paths.appPackageJson]),
    ],
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
    new webpack.BannerPlugin({banner: "#!/usr/bin/env node", raw: true}),
  ],
  mode: process.env.NODE_ENV,
} /*: any */);
