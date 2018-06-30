// @flow
import React from "react";
import ReactDOM from "react-dom";
import {
  BrowserRouter as Router,
  NavLink,
  Redirect,
  Route,
} from "react-router-dom";
import "./index.css";
import V3App from "../../v3/app/App";
import registerServiceWorker from "./registerServiceWorker";

const root = document.getElementById("root");
if (root == null) {
  throw new Error("Unable to find root element!");
}
ReactDOM.render(
  <Router>
    <React.Fragment>
      <strong>Select version:</strong>
      <ul>
        <li>
          <NavLink to="/v3">V3</NavLink>
        </li>
      </ul>
      <Route exact path="/" render={() => <Redirect to="/v3" />} />
      <hr />
      <Route path="/v3" component={V3App} />
    </React.Fragment>
  </Router>,
  root
);
registerServiceWorker();
