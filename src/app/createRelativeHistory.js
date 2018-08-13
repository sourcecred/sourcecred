// @flow

/*
 * This module mediates between three representations of paths:
 *
 *   - In React-space, paths are absolute, rooted semantically with
 *     respect to the application.
 *   - In browser-space, paths are absolute, rooted with respect to the
 *     actual host.
 *   - In DOM-space, paths are relative.
 *
 * For instance, suppose that an application is being served from
 * http://example.com/gateway/. Suppose that we are on the "about us"
 * page, with route "/about-us/". Then the route for the "contact us"
 * page has the following three representations:
 *
 *   - in React-space: "/contact-us/";
 *   - in browser-space: "/gateway/contact-us/";
 *   - in DOM-space: "../contact-us/".
 *
 * These different spaces interact as follows:
 *
 *   - Actual interaction with the `window.history` API uses
 *     browser-space. This is necessary/convenient because
 *     `window.location` is always represented in browser-space.
 *
 *   - Interactions with React Router are in React-space. In particular,
 *     the result of `getCurrentLocation()` is in React-space, and the
 *     argument to `createHref` is in React-space. This is
 *     necessary/convenient because it is an assumption of React Router
 *     (e.g., actual route data must be specified thus).
 *
 *   - The result of `createHref` is in DOM-space. This is
 *     necessary/convenient because an `a` element must have a relative
 *     href, because the gateway is not known at the time that the
 *     static site is generated.
 *
 * Use `createRelativeHistory` to get a history object that provides the
 * right interface to each client.
 */

import type {History /* actually `any` */} from "history";

/**
 * Given a history implementation that operates in browser-space with
 * the provided basename, create a history implementation that operates
 * in React-space, except for `createHref`, which provides results in
 * DOM-space.
 *
 * In a server-side rendering context, the basename should be "/". On
 * the client, the basename depends on the particular gateway from which
 * the page is served, which is known only at runtime and must be
 * computed from `window.location.pathname`.
 *
 * For instance, if `window.location.pathname` is "/foo/bar/about-us/",
 * and we are rendering what is semantically the "/about-us/" route,
 * then `basename` should be "/foo/bar/".
 *
 * The basename must begin and end with a slash. (These may be the same
 * slash.)
 *
 * See module docstring for more details.
 */
export default function createRelativeHistory(
  delegate: History,
  basename: string
): History {
  if (!delegate.getCurrentLocation) {
    // (The `Router` component of `react-router` uses the same check.)
    throw new Error(
      "delegate: expected history@3 implementation, got: " + String(delegate)
    );
  }
  if (typeof basename !== "string") {
    throw new Error("basename: expected string, got: " + basename);
  }
  if (!basename.startsWith("/")) {
    throw new Error("basename: must be absolute: " + basename);
  }
  if (!basename.endsWith("/")) {
    throw new Error("basename: must end in slash: " + basename);
  }
  verifyBasename(delegate.getCurrentLocation().pathname);

  interface Lens {
    (pathname: string): string;
    <T: {+pathname: string}>(location: T): T;
  }

  /**
   * Given a function that transforms a pathname, return a function
   * that:
   *   - transforms strings by interpreting them as pathnames;
   *   - transforms location objects by transforming their pathnames;
   *   - passes through `null` and `undefined` unchanged, with warning.
   */
  function lens(transformPathname: (string) => string): Lens {
    return (value) => {
      // istanbul ignore if
      if (value == null) {
        console.warn("unexpected lens argument: " + String(value));
        // Pass through unchanged.
        return value;
      } else if (typeof value === "string") {
        return (transformPathname(value): any);
      } else {
        const pathname = transformPathname(value.pathname);
        return ({...value, pathname}: any);
      }
    };
  }

  /*
   * Check that the provided browser-space path does indeed begin with
   * the expected basename. If it doesn't, this means that we somehow
   * navigated out of our "sandbox" (maybe someone manually called
   * `window.history.pushState`). All bets are off in that case.
   */
  function verifyBasename(browserPath) {
    if (!browserPath.startsWith(basename)) {
      const p = JSON.stringify(browserPath);
      const b = JSON.stringify(basename);
      throw new Error(`basename violation: ${b} is not a prefix of ${p}`);
    }
  }

  const reactToBrowser = lens((path) => basename + path.replace(/^\//, ""));
  const browserToReact = lens((path) => {
    verifyBasename(path);
    return "/" + path.slice(basename.length);
  });
  const browserToDom = lens((path) => {
    verifyBasename(path);
    const current = delegate.getCurrentLocation().pathname;
    verifyBasename(current);
    const relativeRoot = current
      .slice(basename.length)
      // Strip any file component in the current directory.
      .replace(/\/[^/]*$/, "/")
      // Traverse back up any intermediate directory.
      .replace(/[^/]+/g, "..");
    return relativeRoot + path.slice(basename.length);
  });

  function getCurrentLocation() {
    return browserToReact(delegate.getCurrentLocation());
  }
  function listenBefore(listener) {
    // Result is a function `unlisten: () => void`; no need to
    // transform.
    return delegate.listenBefore((currentLocation) => {
      return listener(browserToReact(currentLocation));
    });
  }
  function listen(listener) {
    // Result is a function `unlisten: () => void`; no need to
    // transform.
    return delegate.listen((currentLocation) => {
      return listener(browserToReact(currentLocation));
    });
  }
  function transitionTo(location) {
    // Result is `undefined`; no need to transform.
    return delegate.transitionTo(reactToBrowser(location));
  }
  function push(location) {
    // Result is `undefined`; no need to transform.
    return delegate.push(reactToBrowser(location));
  }
  function replace(location) {
    // Result is `undefined`; no need to transform.
    return delegate.replace(reactToBrowser(location));
  }
  function go(n) {
    // Result is `undefined`; no need to transform.
    // `n` is an integer; no need to transform.
    return delegate.go(n);
  }
  function goBack() {
    // Result is `undefined`; no need to transform.
    return delegate.goBack();
  }
  function goForward() {
    // Result is `undefined`; no need to transform.
    return delegate.goForward();
  }
  function createKey() {
    // Result is not a path; no need to transform.
    return delegate.createKey();
  }
  function createPath(_unused_location) {
    // It is not clear whether this function is part of the public
    // API. If it is, it is not clear what kind of URL (which
    // representation space) it is supposed to return. This is because
    // the `history` module does not actually have any API docs. This
    // function is not called by React Router v3, so, given that we do
    // not know what the semantics should be, we refrain from
    // implementing it.
    //
    // If this ever throws, maybe we'll have a better idea of what to
    // do.
    throw new Error("createPath is not part of the public API");
  }
  function createHref(location) {
    return browserToDom(delegate.createHref(reactToBrowser(location)));
  }
  function createLocation(location, action) {
    // `action` is an enum constant ("POP", "PUSH", or "REPLACE"); no
    // need to transform it.
    return browserToReact(
      delegate.createLocation(reactToBrowser(location), action)
    );
  }
  return {
    getCurrentLocation,
    listenBefore,
    listen,
    transitionTo,
    push,
    replace,
    go,
    goBack,
    goForward,
    createKey,
    createPath,
    createHref,
    createLocation,
  };
}
