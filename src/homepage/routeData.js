// @flow

// NOTE: This module must be written in vanilla ECMAScript that can be
// run by Node without a preprocessor. That means that we use `exports`
// and `require` instead of ECMAScript module keywords, we lazy-load all
// dependent modules, and we use the Flow comment syntax instead of the
// inline syntax.

/*::
import type {Assets} from "../webutil/assets";
import type {RepoIdRegistry} from "../core/repoIdRegistry";

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

/**
 * Adds an 'Inspection Test', which is a standalone React component
 * which allows us to manually inspect some frontend behavior.
 *
 * Writing inspection tests is especially convenient for cases where it's
 * easy to verify that a component is working properly by manually interacting
 * with it, but hard/expensive to test automatically.
 *
 * An example is a FileUploader component which uploads a file from the user,
 * goes through the FileReader API, etc.
 *
 * TODO([#1148]): Improve the inspection testing system (e.g. so we can access
 * a list of all tests from the frontend), and separate it from serving the
 * homepage.
 *
 * [#1148]: https://github.com/sourcecred/sourcecred/issues/1148
 */
function inspectionTestFor(name, component) /*: RouteDatum */ {
  return {
    path: "/test/" + name + "/",
    contents: {
      type: "PAGE",
      component: component,
    },
    title: "Inspection test for: " + name,
    navTitle: null,
  };
}

function makeRouteData(registry /*: RepoIdRegistry */) /*: RouteData */ {
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
      path: "/prototype/",
      contents: {
        type: "PAGE",
        component: () => require("./PrototypesPage").default(registry),
      },
      title: "SourceCred prototype",
      navTitle: "Prototype",
    },
    ...registry.map((entry) => ({
      path: `/prototype/${entry.repoId.owner}/${entry.repoId.name}/`,
      contents: {
        type: "PAGE",
        component: () => require("./ProjectPage").default(entry.repoId),
      },
      title: `${entry.repoId.owner}/${entry.repoId.name} • SourceCred`,
      navTitle: null,
    })),
    {
      path: "/odyssey/",
      contents: {
        type: "PAGE",
        component: () => require("./OdysseyPage").default,
      },
      title: "Odyssey Prototype",
      navTitle: null,
    },
    {
      path: "/discord-invite/",
      contents: {
        type: "EXTERNAL_REDIRECT",
        redirectTo: "https://discord.gg/tsBTgc9",
      },
      title: "SourceCred Discord invite",
      navTitle: null,
    },
    // Inspection Tests Below //
    inspectionTestFor(
      "FileUploader",
      () => require("../util/FileUploaderInspectionTest").default
    ),
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
