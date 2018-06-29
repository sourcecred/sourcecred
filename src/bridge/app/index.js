// @flow
import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import V1App from "../../v1/app/App";
import registerServiceWorker from "./registerServiceWorker";

const root = document.getElementById("root");
if (root == null) {
  throw new Error("Unable to find root element!");
}
ReactDOM.render(<V1App />, root);
registerServiceWorker();
