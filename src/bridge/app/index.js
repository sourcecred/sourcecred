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
import V1App from "../../v1/app/App";
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
          <NavLink to="/v1">V1</NavLink>
        </li>
      </ul>
      <Route exact path="/" render={() => <Redirect to="/v1" />} />
      <hr />
      <Route path="/v1" component={V1App} />
    </React.Fragment>
  </Router>,
  root
);
registerServiceWorker();
