import {idToString, stringToID} from "./graph";

describe("graph", () => {
  describe("idToString", () => {
    const makeSimpleID = () => ({
      pluginName: "widgets",
      repositoryName: "megacorp/megawidget",
      name: "issue#123",
    });
    it("stringifies a simple ID", () => {
      const input = makeSimpleID();
      const expected = "widgets$megacorp/megawidget$issue#123";
      expect(idToString(input)).toEqual(expected);
    });
    function expectRejection(attribute, value) {
      const input = {...makeSimpleID(), [attribute]: value};
      expect(() => idToString(input)).toThrow(RegExp(attribute));
      // (escaping regexp in JavaScript is a nightmare; ignore it)
    }
    it("rejects an ID with $-signs in plugin name", () => {
      expectRejection("pluginName", "widg$ets");
    });
    it("rejects an ID with $-signs in repository name", () => {
      expectRejection("repositoryName", "megacorp$megawidget");
    });
    it("rejects an ID with $-signs in name", () => {
      expectRejection("name", "issue$123");
    });
  });

  describe("stringToID", () => {
    it("parses a simple ID-string", () => {
      const input = "widgets$megacorp/megawidget$issue#123";
      const expected = {
        pluginName: "widgets",
        repositoryName: "megacorp/megawidget",
        name: "issue#123",
      };
      expect(stringToID(input)).toEqual(expected);
    });
    [0, 1, 3, 4].forEach((n) => {
      it(`rejects an ID-string with ${n} occurrences of "\$"`, () => {
        const dollars = Array(n + 1).join("$");
        const input = `mega${dollars}corp`;
        expect(() => stringToID(input)).toThrow(/exactly two \$s/);
      });
    });
  });

  describe("stringToID and idToString interop", () => {
    const examples = () => [
      {
        object: {
          pluginName: "widgets",
          repositoryName: "megacorp/megawidget",
          name: "issue#123",
        },
        string: "widgets$megacorp/megawidget$issue#123",
      },
    ];
    examples().forEach((example, index) => {
      describe(`for example at 0-index ${index}`, () => {
        it("has stringToID a left identity for idToString", () => {
          expect(stringToID(idToString(example.object))).toEqual(
            example.object
          );
        });
        it("has stringToID a right identity for idToString", () => {
          expect(idToString(stringToID(example.string))).toEqual(
            example.string
          );
        });
      });
    });
  });
});
