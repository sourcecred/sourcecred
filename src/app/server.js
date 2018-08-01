// @flow

import {StyleSheetServer} from "aphrodite/no-important";
import React from "react";
import ReactDOMServer from "react-dom/server";
import {match, RouterContext} from "react-router";

import Page from "./Page";
import ExternalRedirect from "./ExternalRedirect";
import {createRoutes} from "./createRoutes";
import {resolveRouteFromPath, resolveTitleFromPath} from "./routeData";
import dedent from "../util/dedent";

export default function render(
  locals: {+path: string, +assets: {[string]: string}},
  callback: (error: ?mixed, result?: string) => void
): void {
  const path = locals.path;
  {
    const route = resolveRouteFromPath(path);
    if (route && route.contents.type === "EXTERNAL_REDIRECT") {
      return renderRedirect(route.contents.redirectTo);
    } else {
      return renderStandardRoute();
    }
  }

  function renderStandardRoute() {
    const bundlePath = locals.assets["main"];
    const routes = createRoutes();
    match({routes, location: path}, (error, redirectLocation, renderProps) => {
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
          <link rel="shortcut icon" href="/favicon.ico" />
          <link href="https://fonts.googleapis.com/css?family=Roboto" rel="stylesheet">
          <link href="https://fonts.googleapis.com/css?family=Roboto+Condensed" rel="stylesheet">
          <title>${resolveTitleFromPath(path)}</title>
          <style>${require("./style/index.css")}</style>
          <style data-aphrodite>${css.content}</style>
          </head>
          <body style="overflow-y:scroll">
          <div id="root">${html}</div>
          <script src="${bundlePath}"></script>
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
      <Page>
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
      <link rel="shortcut icon" href="/favicon.ico" />
      <link href="https://fonts.googleapis.com/css?family=Roboto" rel="stylesheet">
      <link href="https://fonts.googleapis.com/css?family=Roboto+Condensed" rel="stylesheet">
      <title>${resolveTitleFromPath(path)}</title>
      <style>${require("./style/index.css")}</style>
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
