// @flow
import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import App from "./App";

const root = document.getElementById("root");
if (root == null) {
  throw new Error("Unable to find root element!");
}
ReactDOM.hydrate(<App />, root);
