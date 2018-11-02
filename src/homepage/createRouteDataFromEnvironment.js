// @flow

import type {RepoIdRegistry} from "../core/repoIdRegistry";
import {type RouteData, makeRouteData} from "./routeData";

export default function createRouteDataFromEnvironment(): RouteData {
  const raw = process.env.REPO_REGISTRY;
  if (raw == null) {
    throw new Error("fatal: repo ID registry unset");
  }
  const registry: RepoIdRegistry = JSON.parse(raw);
  return makeRouteData(registry);
}
