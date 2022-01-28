// @no-flow
const repl = require("repl");
const context = repl.start("$ ").context;

try {
  context.sc = require("../dist/server/api.js").sourcecred;
  context.scClient = require("../dist/client/api.js");
} catch (e) {
  console.log(
    "\nAn error occurred. Try running `yarn build` before opening the shell.\n"
  );
  throw e;
}
