import {addressToString, stringToAddress} from "./graph";

describe("graph", () => {
  describe("addressToString", () => {
    const makeSimpleAddress = () => ({
      repositoryName: "megacorp/megawidget",
      pluginName: "widgets",
      id: "issue#123",
    });
    it("stringifies a simple Address", () => {
      const input = makeSimpleAddress();
      const expected = "megacorp/megawidget$widgets$issue#123";
      expect(addressToString(input)).toEqual(expected);
    });
    function expectRejection(attribute, value) {
      const input = {...makeSimpleAddress(), [attribute]: value};
      expect(() => addressToString(input)).toThrow(RegExp(attribute));
      // (escaping regexp in JavaScript is a nightmare; ignore it)
    }
    it("rejects an Address with $-signs in plugin name", () => {
      expectRejection("pluginName", "widg$ets");
    });
    it("rejects an Address with $-signs in repository name", () => {
      expectRejection("repositoryName", "megacorp$megawidget");
    });
    it("rejects an Address with $-signs in id", () => {
      expectRejection("id", "issue$123");
    });
  });

  describe("stringToAddress", () => {
    it("parses a simple Address-string", () => {
      const input = "megacorp/megawidget$widgets$issue#123";
      const expected = {
        repositoryName: "megacorp/megawidget",
        pluginName: "widgets",
        id: "issue#123",
      };
      expect(stringToAddress(input)).toEqual(expected);
    });
    [0, 1, 3, 4].forEach((n) => {
      it(`rejects an Address-string with ${n} occurrences of "\$"`, () => {
        const dollars = Array(n + 1).join("$");
        const input = `mega${dollars}corp`;
        expect(() => stringToAddress(input)).toThrow(/exactly two \$s/);
      });
    });
  });

  describe("stringToAddress and addressToString interop", () => {
    const examples = () => [
      {
        object: {
          repositoryName: "megacorp/megawidget",
          pluginName: "widgets",
          id: "issue#123",
        },
        string: "megacorp/megawidget$widgets$issue#123",
      },
    ];
    examples().forEach((example, index) => {
      describe(`for example at 0-index ${index}`, () => {
        it("has stringToAddress a left identity for addressToString", () => {
          expect(stringToAddress(addressToString(example.object))).toEqual(
            example.object
          );
        });
        it("has stringToAddress a right identity for addressToString", () => {
          expect(addressToString(stringToAddress(example.string))).toEqual(
            example.string
          );
        });
      });
    });
  });
});
