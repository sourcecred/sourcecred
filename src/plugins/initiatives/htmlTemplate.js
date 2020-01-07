// @flow

import {DomHandler, DomUtils, Parser} from "htmlparser2";
import {type URL} from "./initiative";

/*
All headers are case-insensitive and can be h1-h6.
Headers can appear in any order.
A matching header for each field must appear exactly once.
The expected pattern for a cooked HTML template:

    ## Status: complete

    Status value must be in the header, prefixed by "Status:".
    Either "complete" or "completed". A missing status value,
    or any other value is considered incomplete.

    ## Champions:

    - [@Beanow](/u/beanow)

    Any URLs that appear in the content below the "Champion" or "Champions" header.
    No filters on user-like types applied here, that's left for after reference detection.

    ## Dependencies:

    - [Dependency](/t/topic/123)

    Any URLs that appear in the content below the "Dependency" or "Dependencies" header.

    ## References:

    - [Reference](/t/topic/123)

    Any URLs that appear in the content below the "Reference" or "References" header.

    ## Contributions:

    - [Contribution](/t/topic/123)

    Any URLs that appear in the content below the "Contribution" or "Contributions" header.
*/

/**
 * A mapping from an HTML header, to any URLs in the body that follows it.
 */
type HeaderToURLsMap = Map<string, $ReadOnlyArray<URL>>;

/**
 * A partial Iniatiative object, parsed from the Cooked HTML template.
 */
export type HtmlTemplateInitiativePartial = {|
  +completed: boolean,
  +dependencies: $ReadOnlyArray<URL>,
  +references: $ReadOnlyArray<URL>,
  +contributions: $ReadOnlyArray<URL>,
  +champions: $ReadOnlyArray<URL>,
|};

/**
 * Attempts to parse a cooked HTML body for Initiative data.
 *
 * Throws when it doesn't match the template.
 */
export function parseCookedHtml(
  cookedHTML: string
): HtmlTemplateInitiativePartial {
  const htu: HeaderToURLsMap = groupURLsByHeader(cookedHTML);
  const completed = findCompletionStatus(htu);
  const champions = singleMatch(htu, new RegExp(/^Champions?/i));
  const contributions = singleMatch(htu, new RegExp(/^Contributions?/i));
  const dependencies = singleMatch(htu, new RegExp(/^Dependenc(y|ies)/i));
  const references = singleMatch(htu, new RegExp(/^References?/i));

  const missing = [];
  if (completed === null) missing.push("status");
  if (!champions) missing.push("champions");
  if (!contributions) missing.push("contributions");
  if (!dependencies) missing.push("dependencies");
  if (!references) missing.push("references");

  if (
    completed == null ||
    champions == null ||
    contributions == null ||
    dependencies == null ||
    references == null
  ) {
    missing.sort();
    throw new Error(`Missing or malformed headers ${JSON.stringify(missing)}`);
  }

  return {
    completed,
    dependencies,
    references,
    contributions,
    champions,
  };
}

/**
 * Takes cooked HTML and creates a HeaderToURLsMap.
 *
 * Cooked HTML being HTML rendered from Markdown. We're assuming this behaves
 * a lot like a subset of HTML, even though the option to write HTML manually
 * exists. For the purpose of parsing Initiative data, we can require just
 * using Markdown.
 *
 * Will throw when there are exact duplicate headers, as this would otherwise
 * silently merge by header in unexpected ways.
 */
export function groupURLsByHeader(cookedHTML: string): HeaderToURLsMap {
  const map: HeaderToURLsMap = new Map();
  const dom = toDOM(cookedHTML);

  let currentHeader: ?string;
  for (const rootEl of dom) {
    switch (rootEl.name) {
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6":
        currentHeader = DomUtils.getText(rootEl);
        if (map.has(currentHeader)) {
          throw new Error(
            `Unsupported duplicate header "${currentHeader}" found`
          );
        }
        // We're also interested in just headers, so make sure an entry exists.
        map.set(currentHeader, []);
        break;
      case "p":
      case "ul":
      case "ol":
        if (currentHeader === undefined) break;
        const existing = map.get(currentHeader) || [];
        const anchors = DomUtils.findAll((el) => el.name === "a", [rootEl]).map(
          (a) => a.attribs.href
        );
        map.set(currentHeader, [...existing, ...anchors]);
        break;
    }
  }

  return map;
}

/**
 * Finds one "Status:" header, where the value is included in the header itself.
 *
 * Returns true when "Status:" is followed by "completed" in the header.
 * Returns false when "Status:" is followed by any other value.
 * Returns null when 0 or >1 headers start with "Status:".
 */
function findCompletionStatus(map: HeaderToURLsMap): boolean | null {
  const pattern = new RegExp(/^Status:(.*)/i);
  const headers = Array.from(map.keys())
    .map((k) => k.trim())
    .filter((k) => pattern.test(k));

  if (headers.length !== 1) {
    return null;
  }

  const matches = headers[0].match(pattern);
  if (matches == null) {
    return null;
  }

  const completedRE = new RegExp(/^completed?$/i);
  return completedRE.test(matches[1].trim());
}

/**
 * Finds one header to match the given RegExp.
 *
 * Returns the associated URL[] when exactly 1 header matches.
 * Returns null when it matches 0 or >1 headers.
 */
function singleMatch(
  map: HeaderToURLsMap,
  pattern: RegExp
): $ReadOnlyArray<URL> | null {
  const headers = Array.from(map.keys()).filter((k) => pattern.test(k.trim()));

  if (headers.length !== 1) {
    return null;
  }

  return map.get(headers[0]) || null;
}

function toDOM(cookedHTML: string): Object {
  // Note: DomHandler is actually synchronous, in spite of the nodeback signature.
  let dom;
  const domHandler = new DomHandler((err, result) => {
    if (err) throw err;
    dom = result;
  });

  const htmlParser = new Parser(domHandler);
  htmlParser.write(cookedHTML);
  htmlParser.end();

  // The .end() forces data to be flushed, so we know DomHandler calls the callback.
  // But in case some implementation detail changes, add this error.
  if (dom === undefined) {
    throw new Error("DomHandler callback wasn't called after htmlParser.end()");
  }

  return dom;
}
