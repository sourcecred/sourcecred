// @flow

import React from "react";
import {Route, NavLink, type Match} from "react-router-dom";

import CredExplorer from "./credExplorer/App";

export default class App extends React.Component<{match: Match}> {
  render() {
    const {match} = this.props;
    const CRED_EXPLORER_ROUTE = match.url + "/explorer";
    return (
      <div>
        <nav>
          <ul>
            <li>
              <NavLink to={match.url}>Home</NavLink>
            </li>
            <li>
              <NavLink to={CRED_EXPLORER_ROUTE}>Cred Explorer</NavLink>
            </li>
          </ul>
        </nav>

        <hr />
        <Route exact path={match.url} component={Home} />
        <Route path={CRED_EXPLORER_ROUTE} component={CredExplorer} />
      </div>
    );
  }
}

const Home = () => (
  <div>
    <h1>Welcome to SourceCred! Please enjoy your stay.</h1>
  </div>
);
