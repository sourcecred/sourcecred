// @flow

import React from "react";
import {BrowserRouter as Router, Route, NavLink} from "react-router-dom";

import CredExplorer from "./credExplorer/App";

export default class App extends React.Component<{}> {
  render() {
    const CRED_EXPLORER_ROUTE = "/explorer";
    return (
      <Router>
        <React.Fragment>
          <nav>
            <ul>
              <li>
                <NavLink to="/">Home</NavLink>
              </li>
              <li>
                <NavLink to={CRED_EXPLORER_ROUTE}>Cred Explorer</NavLink>
              </li>
            </ul>
          </nav>

          <hr />
          <Route exact path="/" component={Home} />
          <Route path={CRED_EXPLORER_ROUTE} component={CredExplorer} />
        </React.Fragment>
      </Router>
    );
  }
}

const Home = () => (
  <div>
    <h1>Welcome to SourceCred! Please make yourself at home.</h1>
  </div>
);
