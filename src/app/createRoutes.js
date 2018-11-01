// @flow

import React from "react";
import {IndexRoute, Route} from "react-router";

import Page from "./Page";
import ExternalRedirect from "./ExternalRedirect";
import withAssets from "../webutil/withAssets";
import {routeData} from "./routeData";

export function createRoutes() {
  return (
    <Route path="/" component={withAssets(Page)}>
      {routeData.map(({path, contents}) => {
        switch (contents.type) {
          case "PAGE":
            if (path === "/") {
              return (
                <IndexRoute
                  key={path}
                  component={withAssets(contents.component())}
                />
              );
            } else {
              return (
                <Route
                  key={path}
                  path={path}
                  component={withAssets(contents.component())}
                />
              );
            }
          case "EXTERNAL_REDIRECT":
            return (
              <Route
                key={path}
                path={path}
                component={() => (
                  <ExternalRedirect redirectTo={contents.redirectTo} />
                )}
              />
            );
          default:
            throw new Error((contents.type: empty));
        }
      })}
    </Route>
  );
}
