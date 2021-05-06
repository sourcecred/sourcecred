// @flow

import generateFlowTypes from "./generateFlowTypes";
import * as Schema from "./schema";

describe("graphql/generateFlowTypes", () => {
  function run(schema: Schema.Schema): string {
    return generateFlowTypes(schema, {parser: "babel", trailingComma: "es5"});
  }

  describe("generateFlowTypes", () => {
    it("works on a representative schema", () => {
      // This schema should be constructed as to singlehandedly achieve
      // full test coverage.
      const s = Schema;
      const schema = s.schema({
        String: s.scalar("string"),
        DateTime: s.scalar("string"),
        Dollars: s.scalar("number"),
        Color: s.enum(["RED", "GREEN", "BLUE"]),
        PaintJob: s.object({
          id: s.id(),
          metadata: s.primitive(/* unannotated */),
          cost: s.primitive(s.nonNull("Dollars")),
          completed: s.primitive(s.nullable("DateTime")),
          color: s.primitive(s.nonNull("Color")),
          designer: s.node("Actor"),
          painters: s.connection("Actor"),
          client: s.node(
            "Human",
            s.unfaithful(["Human", "TalentedChimpanzee"])
          ),
          coClients: s.connection(
            "Human",
            s.unfaithful(["Human", "TalentedChimpanzee"])
          ),
          referrer: s.node("PaintJob"),
          relatedWork: s.connection("PaintJob"),
          details: s.nested({
            moreMetadata: s.primitive(),
            description: s.primitive(s.nullable("String")),
            oldColor: s.primitive(s.nonNull("Color")),
            oldPainter: s.node("Actor"),
            oldClient: s.node(
              "Human",
              s.unfaithful(["Human", "TalentedChimpanzee"])
            ),
          }),
        }),
        Actor: s.union(["Human", "TalentedChimpanzee"]),
        Human: s.object({
          id: s.id(),
          name: s.primitive(s.nullable("String")),
        }),
        TalentedChimpanzee: s.object({
          id: s.id(),
          name: s.primitive(s.nullable("String")),
        }),
        EmptyEnum: s.enum([]),
        EmptyUnion: s.union([]),
        EmptyUnfaithfulSet: s.object({
          id: s.id(),
          foo: s.node("Human", s.unfaithful([])),
        }),
      });
      expect(run(schema)).toMatchSnapshot();
    });

    it("respects the Prettier options", () => {
      const s = Schema;
      const schema = s.schema({
        E: s.enum(["ONE", "TWO"]),
      });
      const options1 = {parser: "babel", singleQuote: false};
      const options2 = {parser: "babel", singleQuote: true};
      const output1 = generateFlowTypes(schema, options1);
      const output2 = generateFlowTypes(schema, options2);
      expect(output1).not.toEqual(output2);
    });

    it("is invariant with respect to type definition order", () => {
      const s = Schema;
      const s1 = s.schema({
        A: s.object({id: s.id()}),
        B: s.object({id: s.id()}),
      });
      const s2 = s.schema({
        B: s.object({id: s.id()}),
        A: s.object({id: s.id()}),
      });
      expect(run(s1)).toEqual(run(s2));
    });

    it("is invariant with respect to enum clause order", () => {
      const s = Schema;
      const s1 = s.schema({
        E: s.enum(["ONE", "TWO"]),
      });
      const s2 = s.schema({
        E: s.enum(["TWO", "ONE"]),
      });
      expect(run(s1)).toEqual(run(s2));
    });

    it("is invariant with respect to object field order", () => {
      const s = Schema;
      const s1 = s.schema({
        O: s.object({
          id: s.id(),
          x: s.primitive(),
          y: s.primitive(),
        }),
      });
      const s2 = s.schema({
        O: s.object({
          id: s.id(),
          y: s.primitive(),
          x: s.primitive(),
        }),
      });
      expect(run(s1)).toEqual(run(s2));
    });

    it("is invariant with respect to nested egg order", () => {
      const s = Schema;
      const s1 = s.schema({
        O: s.object({
          id: s.id(),
          nest: s.nested({
            x: s.primitive(),
            y: s.primitive(),
          }),
        }),
      });
      const s2 = s.schema({
        O: s.object({
          id: s.id(),
          nest: s.nested({
            y: s.primitive(),
            x: s.primitive(),
          }),
        }),
      });
      expect(run(s1)).toEqual(run(s2));
    });

    it("is invariant with respect to unfaithful typename order", () => {
      const s = Schema;
      const s1 = s.schema({
        O: s.object({
          id: s.id(),
          x: s.node("A", s.unfaithful(["A", "B"])),
        }),
        A: s.object({id: s.id()}),
        B: s.object({id: s.id()}),
      });
      const s2 = s.schema({
        O: s.object({
          id: s.id(),
          x: s.node("A", s.unfaithful(["B", "A"])),
        }),
        A: s.object({id: s.id()}),
        B: s.object({id: s.id()}),
      });
      expect(run(s1)).toEqual(run(s2));
    });

    it("is invariant with respect to union clause order", () => {
      const s = Schema;
      const s1 = s.schema({
        A: s.object({id: s.id()}),
        B: s.object({id: s.id()}),
        U: s.union(["A", "B"]),
      });
      const s2 = s.schema({
        A: s.object({id: s.id()}),
        B: s.object({id: s.id()}),
        U: s.union(["B", "A"]),
      });
      expect(run(s1)).toEqual(run(s2));
    });
  });
});
