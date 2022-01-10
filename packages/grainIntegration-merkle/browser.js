// @flow
import { OpenClaimButton } from "./src/App";

// This is a placeholder for what will ultimately be the frontend for
// interacting with the merkle grain integration.
//
// For now, it's needed as a decoy so the browser-targeted webpack builds
// don't try to resolve the fs-dependent modules in index.js

export function merkleIntegration() {
  throw new Error("Not Implemented");
}

export { OpenClaimButton };
