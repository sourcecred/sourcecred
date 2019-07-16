// @flow

import {makeRouteData} from "./routeData";

describe("homepage/routeData", () => {
  function routeData() {
    return makeRouteData([
      "sourcecred/example-github",
      "sourcecred/sourcecred",
    ]);
  }

  /*
   * React Router doesn't support relative paths. I'm not sure exactly
   * what a path without a leading slash would do; it's asking for
   * trouble. If we need them, we can reconsider this test.
   */
  it("every path has a leading slash", () => {
    for (const route of routeData()) {
      if (!route.path.startsWith("/")) {
        expect(route.path).toEqual("/" + route.path);
      }
    }
  });

  /*
   * A route representing a page should have a trailing slash so that
   * relative links work in the expected way. For instance, a route
   * "/about/team/" may reference "/about/logo.png" via "../logo.png".
   * But for the route "/about/team", "../logo.png" refers instead to
   * "/logo.png", which is not the intended semantics. Therefore, we
   * should consistently either include or omit trailing slashes to
   * avoid confusion.
   *
   * The choice is made for us by the fact that many web servers
   * (prominently, GitHub Pages and Python's SimpleHTTPServer) redirect
   * "/foo" to "/foo/" when serving "/foo/index.html".
   *
   * In theory, we might have some file routes like "/about/data.csv"
   * that we actually want to appear without a trailing slash. But those
   * are outside the scope of our React application, and should be
   * handled by a different pipeline (e.g., `copy-webpack-plugin`).
   */
  it("every path has a trailing slash", () => {
    for (const route of routeData()) {
      if (!route.path.endsWith("/")) {
        expect(route.path).toEqual(route.path + "/");
      }
    }
  });
});
