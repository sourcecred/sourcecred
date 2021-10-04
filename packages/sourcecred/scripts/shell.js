// @no-flow
var repl = require("repl");
var context = repl.start("$ ").context;

try {
  context.sc = require("../dist/server/api.js").sourcecred;
  context.scClient = require("../dist/client/api.js");
} catch (e) {
  throw "Run `yarn build` before opening the shell.";
}
