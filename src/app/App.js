// @flow

import React from "react";
import {Router, browserHistory} from "react-router";

import {createRoutes} from "./createRoutes";
import {resolveTitleFromPath} from "./routeData";

export default class App extends React.Component<{}> {
  render() {
    return (
      <Router
        history={browserHistory}
        routes={createRoutes()}
        onUpdate={function() {
          const router = this;
          const path: string = router.state.location.pathname;
          document.title = resolveTitleFromPath(path);
        }}
      />
    );
  }
}
