// @flow

import express from "express";

export default function apiApp(sourcecredDirectory: string) {
  const app = express();
  app.use("/api/v1/data", express.static(sourcecredDirectory));
  return app;
}
