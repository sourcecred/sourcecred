// @flow

const htmlparser2 = require("htmlparser2");

export type Hyperlink = string;

export function parseLinks(cookedHtml: string): Hyperlink[] {
  const links = [];
  const httpRegex = /^https?:\/\//;
  const parser = new htmlparser2.Parser({
    onopentag(name, attribs) {
      if (name === "a") {
        const href = attribs.href;
        if (href != null) {
          if (href.match(httpRegex)) {
            links.push(href);
          }
        }
      }
    },
  });
  parser.write(cookedHtml);
  parser.end();
  return links;
}
