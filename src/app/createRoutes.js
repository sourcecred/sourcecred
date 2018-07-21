// @flow

import React from "react";
import {IndexRoute, Route} from "react-router";

import Page from "./Page";
import {routeData} from "./routeData";

export function createRoutes() {
  return (
    <Route path="/" component={Page}>
      {routeData.map(({path, component}) => {
        if (path === "/") {
          return <IndexRoute key={path} component={component()} />;
        } else {
          return <Route key={path} path={path} component={component()} />;
        }
      })}
    </Route>
  );
}
