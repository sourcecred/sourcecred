// @no-flow
const webpack = require("webpack");
const eslintFormatter = require("react-dev-utils/eslintFormatter");
const ModuleScopePlugin = require("react-dev-utils/ModuleScopePlugin");
const paths = require("./paths");
const nodeExternals = require("webpack-node-externals");

// This is the backend configuration. It builds applications that target
// Node and will not run in a browser.
module.exports = (outputPath) => ({
  // Don't attempt to continue if there are any errors.
  bail: true,
  // Target Node instead of the browser.
  target: "node",
  entry: paths.backendEntryPoints,
  externals: [nodeExternals()],
  output: {
    path: outputPath,
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
      // First, run the linter.
      // It's important to do this before Babel processes the JS.
      {
        test: /\.(js|jsx|mjs)$/,
        enforce: "pre",
        use: [
          {
            options: {
              formatter: eslintFormatter,
              eslintPath: require.resolve("eslint"),
            },
            loader: require.resolve("eslint-loader"),
          },
        ],
        include: paths.appSrc,
      },
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
    new webpack.DefinePlugin({
      "process.env.NODE_ENV": JSON.stringify(
        process.env.NODE_ENV || "development"
      ),
    }),
  ],
});
