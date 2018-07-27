// @flow

import dedent from "./dedent";

describe("util/dedent", () => {
  it("dedents a simple example", () => {
    const actual = dedent`\
      hello
        good
      world
    `;
    const expected = "hello\n  good\nworld\n";
    expect(actual).toEqual(expected);
  });

  it("interpolates components", () => {
    const ell = "l";
    const actual = dedent`\
      he${ell}${ell}o
        good
      wor${ell}d
    `;
    const expected = "hello\n  good\nworld\n";
    expect(actual).toEqual(expected);
  });

  it("does not strip leading whitespace in components", () => {
    // See: https://github.com/wchargin/wchargin.github.io/commit/06475d4cc44a0437c911dd2d4d6275be4381142e
    const code = 'if (true) {\n  console.log("hi");\n}';
    const actual = dedent`\
    <pre><code>${code}</code></pre>
    `;
    const expected = `<pre><code>${code}</code></pre>\n`;
    expect(actual).toEqual(expected);
  });

  it("does not strip trailing backslashes", () => {
    // See: https://github.com/wchargin/wchargin.github.io/commit/06475d4cc44a0437c911dd2d4d6275be4381142e
    const code = "printf '%s' \\\n wat";
    const actual = dedent`\
    $ cat foo.sh
    ${code}
    `;
    const expected = `$ cat foo.sh\n${code}\n`;
    expect(actual).toEqual(expected);
  });
});
