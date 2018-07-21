// @flow

import React from "react";
import {IndexRoute, Route} from "react-router";

import Page from "./Page";

type RouteDatum = {|
  +path: string,
  +component: React$ComponentType<{||}>,
  +title: string,
  +navTitle: ?string,
|};

export const routeData: $ReadOnlyArray<RouteDatum> = [
  {
    path: "/",
    component: require("./HomePage").default,
    title: "SourceCred",
    navTitle: "Home",
  },
  {
    path: "/explorer",
    component: require("./credExplorer/App").default,
    title: "SourceCred explorer",
    navTitle: "Explorer",
  },
];

export function createRoutes() {
  return (
    <Route path="/" component={Page}>
      {routeData.map(({path, component}) => {
        if (path === "/") {
          return <IndexRoute key={path} component={component} />;
        } else {
          return <Route key={path} path={path} component={component} />;
        }
      })}
    </Route>
  );
}
