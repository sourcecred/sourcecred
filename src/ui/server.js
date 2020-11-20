// @flow

import {StyleSheetServer} from "aphrodite/no-important";
import React from "react";
import ReactDOMServer from "react-dom/server";
import {StaticRouter} from "react-router";
import {ServerStyleSheets} from "@material-ui/core/styles";

import dedent from "../util/dedent";
import {Assets, rootFromPath} from "../webutil/assets";
import App from "./components/AdminApp";

export default function render(
  locals: {+path: string, +assets: {[string]: string}},
  callback: (error: ?mixed, result?: string) => void
): void {
  const path = locals.path;
  const root = rootFromPath(path);
  const assets = new Assets(root);
  const context = {};

  return renderStandardRoute();

  function renderStandardRoute() {
    const bundlePath = locals.assets["main"];

    // Reference for MUI stylesheet injections into SSR HTML:
    // https://material-ui.com/guides/server-rendering/#handling-the-request
    const sheets = new ServerStyleSheets();
    const {html, css} = StyleSheetServer.renderStatic(() =>
      ReactDOMServer.renderToString(
        sheets.collect(
          <StaticRouter location={path} context={context}>
            <App />
          </StaticRouter>
        )
      )
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
      <title>SourceCred</title>
      <style>${require("./index.css")}</style>
      <style data-aphrodite>${css.content}</style>
      <style id="jss-server-side">${sheets.toString()}</style>
      </head>
      <body>
      <div id="root" data-initial-root="${root}">${html}</div>
      <script src="${assets.resolve(bundlePath)}"></script>
      </body>
      </html>
    `;
    callback(null, page);
  }
}
