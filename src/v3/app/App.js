// @flow

import React from "react";
import {Route, NavLink, type Match} from "react-router-dom";

export default class App extends React.Component<{match: Match}> {
  render() {
    const {match} = this.props;
    return (
      <div>
        <nav>
          <ul>
            <li>
              <NavLink to={match.url}>Home</NavLink>
            </li>
          </ul>
        </nav>

        <hr />
        <Route exact path={match.url} component={Home} />
      </div>
    );
  }
}

const Home = () => (
  <div>
    <h1>Welcome to SourceCred! Please make yourself at home.</h1>
  </div>
);
