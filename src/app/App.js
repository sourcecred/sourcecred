// @flow

import React from "react";
import {BrowserRouter as Router, Route, NavLink} from "react-router-dom";

import ArtifactEditor from "@/plugins/artifact/editor/App";
import CredExplorer from "./credExplorer/App";

export default class App extends React.Component<{}> {
  render() {
    const ARTIFACT_EDITOR_ROUTE = "/plugins/artifact/editor";
    const CRED_EXPLORER_ROUTE = "/explorer";
    return (
      <Router>
        <div>
          <nav>
            <ul>
              <li>
                <NavLink to="/">Home</NavLink>
              </li>
              <li>
                <NavLink to={CRED_EXPLORER_ROUTE}>Cred Explorer</NavLink>
              </li>
              <li>
                <NavLink to={ARTIFACT_EDITOR_ROUTE}>Artifact Editor</NavLink>
              </li>
            </ul>
          </nav>

          <hr />
          <Route exact path="/" component={Home} />
          <Route path={CRED_EXPLORER_ROUTE} component={CredExplorer} />
          <Route path={ARTIFACT_EDITOR_ROUTE} component={ArtifactEditor} />
        </div>
      </Router>
    );
  }
}

const Home = () => (
  <div>
    <h1>Welcome to SourceCred! Please enjoy your stay.</h1>
  </div>
);
