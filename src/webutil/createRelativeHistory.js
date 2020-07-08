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
 *     the contents of `location` is in React-space, and the
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

export type History = any;
declare function Unblock(): void;

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
  if (!delegate.location) {
    // (The `Router` component of `react-router` uses the same check.)
    throw new Error(
      "delegate: expected history@4 implementation, got:" + String(delegate)
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
  verifyBasename(delegate.location.pathname);

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
    const current = delegate.location.pathname;
    verifyBasename(current);
    const relativeRoot = current
      .slice(basename.length)
      // Strip any file component in the current directory.
      .replace(/\/[^/]*$/, "/")
      // Traverse back up any intermediate directory.
      .replace(/[^/]+/g, "..");
    return relativeRoot + path.slice(basename.length);
  });

  function listen(listener) {
    // Result is a function `unlisten: () => void`; no need to
    // transform.
    return delegate.listen((currentLocation) => {
      return listener(browserToReact(currentLocation));
    });
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
  function createHref(location) {
    return browserToDom(delegate.createHref(reactToBrowser(location)));
  }
  function block(prompt): typeof Unblock {
    // Result is `Unblock` hook
    // `prompt` is either a prompt string or
    // a callback that is called after history is updated
    return delegate.block(prompt);
  }
  const rawRelativeHistory = {
    block,
    createHref,
    delegate,
    go,
    goBack,
    goForward,
    listen,
    push,
    replace,
  };

  /*
   * expose delegate state via calls to the parent `relativeHistory`
   *
   * For consistency, duplicating state in `relativeHistory` (the parent) must be avoided, but
   * the history api must provide access to location state via top-level property access.
   * This handler allows top-level state accesses to be redirected to the delegate state
   * and recontextualized where necessary
   *
   * This is accomplished using a Proxy
   * (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy)
   * The getter handler provides direct access to underlying objects via top-level requests
   *
   * calls to location are processed through `browserToReact` to yield the expected react-space
   * in the returned path
   */
  const delegateHistoryPropertyHandler = {
    get: function (relativeHistory, prop) {
      switch (prop) {
        case "location":
          return browserToReact(relativeHistory.delegate[prop]);
        case "action":
        case "length":
        case "index":
          return relativeHistory.delegate[prop];
        case "entries":
          return relativeHistory.delegate[prop].map(browserToReact);
        default:
          return prop in relativeHistory ? relativeHistory[prop] : undefined;
      }
    },
  };
  return new Proxy(rawRelativeHistory, delegateHistoryPropertyHandler);
}
