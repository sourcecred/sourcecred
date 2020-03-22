// @flow

import React from "react";
import {Router} from "react-router";
import type {History /* actually `any` */} from "history";

import {createRoutes} from "./createRoutes";
import {type RouteData, resolveTitleFromPath} from "./routeData";

export default class App extends React.Component<{|
  +routeData: RouteData,
  +history: History,
|}> {
  render() {
    const {routeData, history} = this.props;
    return (
      <Router
        history={history}
        routes={createRoutes(routeData)}
        onUpdate={function () {
          const router = this;
          const path: string = router.state.location.pathname;
          document.title = resolveTitleFromPath(routeData, path);
        }}
      />
    );
  }
}
