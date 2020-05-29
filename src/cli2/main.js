// @flow

import {handlingErrors} from "./command";
import sourcecred from "./sourcecred";

require("../tools/entry");

export default function main(): Promise<void> {
  return handlingErrors(sourcecred)(process.argv.slice(2), {
    out: (x) => console.log(x),
    err: (x) => console.error(x),
  }).then((exitCode) => {
    process.exitCode = exitCode;
  });
}

// Only run in the Webpack bundle, not as a Node module (during tests).
/* istanbul ignore next */
/*:: declare var __webpack_require__: mixed; */
// eslint-disable-next-line camelcase
if (typeof __webpack_require__ !== "undefined") {
  main();
}
