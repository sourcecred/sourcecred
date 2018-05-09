// @flow

import express from "express";

export default function apiApp(
  sourcecredDirectory: string,
  staticFiles?: string
) {
  const app = express();
  app.use("/api/v1/data", express.static(sourcecredDirectory));
  if (staticFiles != null) {
    app.use(express.static(staticFiles));
  }
  return app;
}
