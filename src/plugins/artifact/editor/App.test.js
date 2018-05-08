// @no-flow
import React from "react";
import ReactDOM from "react-dom";
import App from "./App";

require("./testUtil").configureAphrodite();

// Check that PropTypes check out.
it("renders without crashing", () => {
  const div = document.createElement("div");
  ReactDOM.render(<App />, div);
  ReactDOM.unmountComponentAtNode(div);
});
