// @flow

/**
 * Represents a normalized Discourse ServerUrl.
 *
 * - Protocols http / https are allowed.
 * - Hostnames are allowed.
 * - Ports are allowed.
 * - Other components are not allowed.
 * - Explicit default ports are removed.
 * - Trailing slashes are removed.
 * - URL is lowercased.
 */
export opaque type ServerUrl: string = string;

/**
 * Does a strict validation of serverUrl inputs and returns an opaque type
 * indicating it's normalized to match our ServerUrl assumptions.
 */
export function parseServerUrl(serverUrl: string): ServerUrl {
  try {
    const url = new global.URL(serverUrl);

    if (!new RegExp(/^https?/i).test(url.protocol)) {
      throw "URL should have a http/https protocol";
    }

    const rebuiltUrl = new global.URL(
      `${url.protocol}//${url.hostname}:${url.port}`
    );

    if (url.toString() !== rebuiltUrl.toString()) {
      throw "Only a hostname and port are allowed";
    }

    // Remove trailing slashes
    return rebuiltUrl.toString().replace(/\/+$/, "");
  } catch (e) {
    throw new Error(
      `Provided Discourse Server URL was invalid: ${serverUrl}\n${e}`
    );
  }
}
