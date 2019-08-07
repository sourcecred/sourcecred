// @flow

import {type RouteData, makeRouteData} from "./routeData";

export default function createRouteDataFromEnvironment(): RouteData {
  const raw = process.env.PROJECT_IDS;
  if (raw == null) {
    throw new Error("fatal: project IDs unset");
  }
  const ids: $ReadOnlyArray<string> = JSON.parse(raw);
  return makeRouteData(ids);
}
