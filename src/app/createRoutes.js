// @flow

import React from "react";
import {IndexRoute, Route} from "react-router";

import Page from "./Page";
import ExternalRedirect from "./ExternalRedirect";
import {routeData} from "./routeData";

export function createRoutes() {
  return (
    <Route path="/" component={Page}>
      {routeData.map(({path, contents}) => {
        switch (contents.type) {
          case "PAGE":
            if (path === "/") {
              return <IndexRoute key={path} component={contents.component()} />;
            } else {
              return (
                <Route
                  key={path}
                  path={path}
                  component={contents.component()}
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
