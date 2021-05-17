// @flow
import React from "react";
import ReactDOM from "react-dom";
import {HashRouter} from "react-router-dom";
import App from "./components/AdminApp";
import {VERSION_SHORT} from "../core/version";

const target = document.getElementById("root");
if (target == null) {
  throw new Error("Unable to find root element!");
}

console.log(`SourceCred version: ${VERSION_SHORT}`);

ReactDOM.hydrate(
  <HashRouter>
    <App />
  </HashRouter>,
  target
);

// In Chrome, relative favicon URLs are recomputed at every pushState,
// although other assets (like the `src` of an `img`) are not. We don't
// want to have to keep the shortcut icon's path up to date as we
// transition; it's simpler to make it absolute at page load.
for (const el of document.querySelectorAll('link[rel="shortcut icon"]')) {
  const link: HTMLLinkElement = (el: any);
  // (Appearances aside, this is not a no-op.)
  link.href = link.href; // eslint-disable-line no-self-assign
}
