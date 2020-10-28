// @flow

const browserify = require("@cypress/browserify-preprocessor");
const {
  initPlugin: initSnapshotPlugin,
} = require("cypress-plugin-snapshots/plugin");

/*::
declare type Cypress$EventHook = (
  name: string,
  exe: (err: {message: string, ...}, runnable: any) => boolean | void
) => void;
*/

// ***********************************************************
// This can be used to load plugins
//
// You can change the location of this file or turn off loading
// the plugins file with the 'pluginsFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/plugins-guide
// ***********************************************************

// This function is called when a project is opened or re-opened (e.g. due to
// the project's config changing)

// TODO (@topocount): create Cypress Config File flow type
module.exports = (on /*: Cypress$EventHook*/, config /*: any*/) /*: any*/ => {
  // `on` is used to hook into various events Cypress emits
  // `config` is the resolved Cypress config

  // initialize the snapshot testing plugin
  initSnapshotPlugin(on, config);

  // utilize the cypress browserify plugin to strip flow type syntax
  const options = browserify.defaultOptions;
  options.browserifyOptions.transform[1][1].presets.push("@babel/preset-flow");
  on("file:preprocessor", browserify(options));

  return config;
};
