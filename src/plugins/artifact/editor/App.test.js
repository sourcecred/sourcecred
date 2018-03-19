import React from "react";
import ReactDOM from "react-dom";
import App from "./App";

import {StyleSheetTestUtils} from "aphrodite/no-important";

beforeEach(() => {
  StyleSheetTestUtils.suppressStyleInjection();
});

afterEach(() => {
  StyleSheetTestUtils.clearBufferAndResumeStyleInjection();
});

// Check that PropTypes check out.
it("renders without crashing", () => {
  const div = document.createElement("div");
  ReactDOM.render(<App />, div);
  ReactDOM.unmountComponentAtNode(div);
});
