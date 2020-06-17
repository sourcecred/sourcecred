// @flow

// NOTE: This module must be written in vanilla ECMAScript that can be
// run by Node without a preprocessor. That means that we use `exports`
// and `require` instead of ECMAScript module keywords, we lazy-load all
// dependent modules, and we use the Flow comment syntax instead of the
// inline syntax.

/*::
import type {Assets} from "../webutil/assets";

type RouteDatum = {|
  +path: string,
  +contents:
    | {|
        +type: "PAGE",
        +component: () => React$ComponentType<{|+assets: Assets|}>,
      |}
    | {|
        +type: "EXTERNAL_REDIRECT",
        +redirectTo: string,
      |},
  +title: string,
  +navTitle: ?string,
|};
export type RouteData = $ReadOnlyArray<RouteDatum>;
*/

function makeRouteData() /*: RouteData */ {
  return [
    {
      path: "/",
      contents: {
        type: "PAGE",
        component: () => require("./HomePage").default,
      },
      title: "SourceCred",
      navTitle: "Home",
    },
    {
      path: "/dashboard/",
      contents: {
        type: "PAGE",
        component: () => require("./Dashboard").default,
      },
      title: "SourceCred Dashboard",
      navTitle: "Dashboard",
    },
  ];
}
exports.makeRouteData = makeRouteData;

function resolveRouteFromPath(
  routeData /*: RouteData */,
  path /*: string */
) /*: ?RouteDatum */ {
  const matches = (candidateRoute) => {
    const candidatePath = candidateRoute.path;
    const start = path.substring(0, candidatePath.length);
    const end = path.substring(candidatePath.length);
    return start === candidatePath && (end.length === 0 || end === "/");
  };
  return routeData.filter(matches)[0] || null;
}
exports.resolveRouteFromPath = resolveRouteFromPath;

function resolveTitleFromPath(
  routeData /*: RouteData */,
  path /*: string */
) /*: string */ {
  const route = resolveRouteFromPath(routeData, path);
  const fallback = "SourceCred";
  return route ? route.title : fallback;
}
exports.resolveTitleFromPath = resolveTitleFromPath;
