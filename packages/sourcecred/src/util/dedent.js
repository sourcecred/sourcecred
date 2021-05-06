// @flow

/*
 * A template tag function that performs dedenting on the template, but
 * not its arguments.
 *
 * For instance, given the template
 *
 *     |dedent`\
 *     |    one ${one}
 *     |        two ${two}
 *     |    done`,
 *
 * where `one === "1"` and `two === "\n    2"`, the template string
 * would expand to "one 1\n    two\n    2\ndone". Note that four spaces
 * of indentation were stripped off of each of "one" and "two", but not
 * from "2".
 *
 * Lines that contain only whitespace are not used for measuring.
 */
export default function dedent(strings: string[], ...values: string[]): string {
  const lineLengths = strings
    .join("")
    .split("\n")
    .filter((line) => line.trim().length !== 0)
    .map((line) => line.length - line.trimLeft().length);
  const trimAmount = Math.min.apply(null, lineLengths);

  const parts = [];
  for (let i = 0; i < strings.length; i++) {
    const trimmed = strings[i]
      .split("\n")
      .map((line, j) => (i === 0 || j > 0 ? line.substr(trimAmount) : line))
      .join("\n");
    parts.push(trimmed);
    if (i < values.length) {
      parts.push(values[i]);
    }
  }
  return parts.join("");
}
