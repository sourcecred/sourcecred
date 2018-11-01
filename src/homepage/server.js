// @flow

import {StyleSheetServer} from "aphrodite/no-important";
import createMemoryHistory from "history/lib/createMemoryHistory";
import React from "react";
import ReactDOMServer from "react-dom/server";
import {match, RouterContext} from "react-router";

import dedent from "../util/dedent";
import {Assets, rootFromPath} from "../webutil/assets";
import createRelativeHistory from "../webutil/createRelativeHistory";
import ExternalRedirect from "./ExternalRedirect";
import Page from "./Page";
import createRouteDataFromEnvironment from "./createRouteDataFromEnvironment";
import {createRoutes} from "./createRoutes";
import {resolveRouteFromPath, resolveTitleFromPath} from "./routeData";

// Side effect for testing purposes
console.log(`REPO_REGISTRY: ${process.env.REPO_REGISTRY || "bad"}`);

// NOTE: This is a side-effect at module load time.
const routeData = createRouteDataFromEnvironment();

export default function render(
  locals: {+path: string, +assets: {[string]: string}},
  callback: (error: ?mixed, result?: string) => void
): void {
  const path = locals.path;
  const root = rootFromPath(path);
  const assets = new Assets(root);
  const history = createRelativeHistory(createMemoryHistory(path), "/");
  {
    const route = resolveRouteFromPath(routeData, path);
    if (route && route.contents.type === "EXTERNAL_REDIRECT") {
      return renderRedirect(route.contents.redirectTo);
    } else {
      return renderStandardRoute();
    }
  }

  function renderStandardRoute() {
    const bundlePath = locals.assets["main"];
    const routes = createRoutes(routeData);
    match({history, routes}, (error, redirectLocation, renderProps) => {
      if (error) {
        callback(error);
      } else if (renderProps) {
        const component = <RouterContext {...renderProps} />;
        const {html, css} = StyleSheetServer.renderStatic(() =>
          ReactDOMServer.renderToString(component)
        );
        const page = dedent`\
          <!DOCTYPE html>
          <html>
          <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <link rel="shortcut icon" href="${assets.resolve("/favicon.png")}" />
          <link href="https://fonts.googleapis.com/css?family=Roboto" rel="stylesheet">
          <link href="https://fonts.googleapis.com/css?family=Roboto+Condensed" rel="stylesheet">
          <title>${resolveTitleFromPath(routeData, path)}</title>
          <style>${require("./index.css")}</style>
          <style data-aphrodite>${css.content}</style>
          </head>
          <body style="overflow-y:scroll">
          <div id="root" data-initial-root="${root}">${html}</div>
          <script src="${assets.resolve(bundlePath)}"></script>
          </body>
          </html>
        `;
        callback(null, page);
      } else {
        // This shouldn't happen because we should only be visiting
        // the right routes.
        throw new Error(`unexpected 404 from ${path}`);
      }
    });
  }

  function renderRedirect(redirectTo: string) {
    const component = (
      <Page routeData={routeData} assets={assets}>
        <ExternalRedirect redirectTo={redirectTo} />
      </Page>
    );
    const {html, css} = StyleSheetServer.renderStatic(() =>
      ReactDOMServer.renderToStaticMarkup(component)
    );
    const page = dedent`\
      <!DOCTYPE html>
      <html>
      <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <meta http-equiv="refresh" content="0;url=${redirectTo}" />
      <link rel="shortcut icon" href="${assets.resolve("favicon.png")}" />
      <link href="https://fonts.googleapis.com/css?family=Roboto" rel="stylesheet">
      <link href="https://fonts.googleapis.com/css?family=Roboto+Condensed" rel="stylesheet">
      <title>${resolveTitleFromPath(routeData, path)}</title>
      <style>${require("./index.css")}</style>
      <style data-aphrodite>${css.content}</style>
      </head>
      <body style="overflow-y:scroll">
      <div id="root">${html}</div>
      </body>
      </html>
    `;
    callback(null, page);
  }
}
