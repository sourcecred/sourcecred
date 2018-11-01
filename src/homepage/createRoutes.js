// @flow

import React from "react";
import {IndexRoute, Route} from "react-router";

import withAssets from "../webutil/withAssets";
import ExternalRedirect from "./ExternalRedirect";
import Page from "./Page";
import type {RouteData} from "./routeData";

export function createRoutes(routeData: RouteData) {
  const PageWithAssets = withAssets(Page);
  const PageWithRoutes = (props) => (
    <PageWithAssets routeData={routeData} {...props} />
  );
  return (
    <Route path="/" component={PageWithRoutes}>
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
