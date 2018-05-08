// @flow
import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import App from "../plugins/artifact/editor/App";
import registerServiceWorker from "./registerServiceWorker";

const root = document.getElementById("root");
if (root == null) {
  throw new Error("Unable to find root element!");
}
ReactDOM.render(<App />, root);
registerServiceWorker();
