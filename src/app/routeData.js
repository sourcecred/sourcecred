// @flow

// NOTE: This module must be written in vanilla ECMAScript that can be
// run by Node without a preprocessor. That means that we use `exports`
// and `require` instead of ECMAScript module keywords, we lazy-load all
// dependent modules, and we use the Flow comment syntax instead of the
// inline syntax.

/*::
type RouteDatum = {|
  +path: string,
  +contents:
    | {|+type: "PAGE", +component: () => React$ComponentType<{||}>|}
    | {|+type: "EXTERNAL_REDIRECT", +redirectTo: string|},
  +title: string,
  +navTitle: ?string,
|};
*/

const routeData /*: $ReadOnlyArray<RouteDatum> */ = [
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
    path: "/explorer",
    contents: {
      type: "PAGE",
      component: () => require("./credExplorer/App").default,
    },
    title: "SourceCred explorer",
    navTitle: "Explore",
  },
  {
    path: "/discord-invite",
    contents: {
      type: "EXTERNAL_REDIRECT",
      redirectTo: "https://discord.gg/tsBTgc9",
    },
    title: "SourceCred Discord invite",
    navTitle: null,
  },
];
exports.routeData = routeData;

function resolveRouteFromPath(path /*: string */) /*: ?RouteDatum */ {
  const matches = (candidateRoute) => {
    const candidatePath = candidateRoute.path;
    const start = path.substring(0, candidatePath.length);
    const end = path.substring(candidatePath.length);
    return start === candidatePath && (end.length === 0 || end === "/");
  };
  return routeData.filter(matches)[0] || null;
}
exports.resolveRouteFromPath = resolveRouteFromPath;

function resolveTitleFromPath(path /*: string */) /*: string */ {
  const route = resolveRouteFromPath(path);
  const fallback = "SourceCred";
  return route ? route.title : fallback;
}
exports.resolveTitleFromPath = resolveTitleFromPath;
