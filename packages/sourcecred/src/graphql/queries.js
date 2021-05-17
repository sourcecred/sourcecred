// @flow

/**
 * GraphQL structured query data format.
 *
 * Main module exports:
 *   - lots of types for various GraphQL language constructs
 *   - the `build` object, providing a fluent builder API
 *   - the `stringify` object, and particularly `stringify.body`
 *   - the two layout strategies `multilineLayout` and `inlineLayout`
 */

export type Body = Definition[];

export type Definition = QueryDefinition | FragmentDefinition;

// We only need opaque type handles; no need to embed the GraphQL type
// system into Flow.
export type GraphQLType = string;

export type QueryDefinition = {|
  +type: "QUERY",
  +name: string,
  +params: Parameter[],
  +selections: Selection[],
|};
export type Parameter = {|+name: string, +type: GraphQLType|};

export type FragmentDefinition = {|
  +type: "FRAGMENT",
  +name: string,
  +typeCondition: GraphQLType,
  +selections: Selection[],
|};

export type Selection = Field | FragmentSpread | InlineFragment;
export type Field = {|
  +type: "FIELD",
  +alias: ?string,
  +name: string,
  +args: Arguments,
  +selections: Selection[],
|};
export type FragmentSpread = {|
  +type: "FRAGMENT_SPREAD",
  +fragmentName: string,
|};
export type InlineFragment = {|
  +type: "INLINE_FRAGMENT",
  +typeCondition: ?GraphQLType,
  +selections: Selection[],
|};

export type Arguments = {[string]: Value};
export type Value =
  | VariableValue
  | LiteralValue
  | EnumValue
  | ListValue
  | ObjectValue;
export type VariableValue = {|+type: "VARIABLE", +data: string|};
export type LiteralValue = {|
  +type: "LITERAL",
  +data: number | string | boolean | null,
|};
export type EnumValue = {|+type: "ENUM", +data: string|};
export type ListValue = {|+type: "LIST", +data: Value[]|};
export type ObjectValue = {|+type: "OBJECT", +data: {[string]: Value}|};

export const build = {
  query(
    name: string,
    params: Parameter[],
    selections: Selection[]
  ): QueryDefinition {
    return {
      type: "QUERY",
      name,
      params,
      selections,
    };
  },

  param(name: string, type: GraphQLType): Parameter {
    return {name, type};
  },

  fragment(
    name: string,
    typeCondition: GraphQLType,
    selections: Selection[]
  ): FragmentDefinition {
    return {
      type: "FRAGMENT",
      name,
      typeCondition,
      selections,
    };
  },

  field(name: string, args: ?Arguments, selections: ?(Selection[])): Field {
    return {
      type: "FIELD",
      alias: null,
      name,
      args: args || {},
      selections: selections || [],
    };
  },

  alias(newAlias: string, field: Field): Field {
    return {
      type: "FIELD",
      alias: newAlias,
      name: field.name,
      args: field.args,
      selections: field.selections,
    };
  },

  fragmentSpread(fragmentName: string): FragmentSpread {
    return {
      type: "FRAGMENT_SPREAD",
      fragmentName,
    };
  },

  inlineFragment(
    typeCondition: ?GraphQLType,
    selections: Selection[]
  ): InlineFragment {
    return {
      type: "INLINE_FRAGMENT",
      typeCondition,
      selections,
    };
  },

  variable(name: string): VariableValue {
    return {
      type: "VARIABLE",
      data: name,
    };
  },

  literal(value: number | string | boolean | null): LiteralValue {
    return {
      type: "LITERAL",
      data: value,
    };
  },

  enumLiteral(value: string): EnumValue {
    return {
      type: "ENUM",
      data: value,
    };
  },

  list(data: Value[]): ListValue {
    return {
      type: "LIST",
      data: data,
    };
  },

  object(data: {[string]: Value}): ObjectValue {
    return {
      type: "OBJECT",
      data: data,
    };
  },
};

/**
 * A strategy for stringifying a sequence of GraphQL language tokens.
 */
export interface LayoutStrategy {
  // Lay out a group of tokens that should be treated atomically.
  atom(line: string): string;

  // Join groups of tokens. The elements should be the results of calls
  // to `atom` (or other `join`s).
  join(lines: string[]): string;

  // Get a strategy for the next level of nesting. For instance, if this
  // object lays out its result over multiple lines, then this method
  // might produce a strategy with one extra level of indentation.
  next(): LayoutStrategy;
}

/**
 * Create a layout strategy that lays out text over multiple lines,
 * indenting with the given tab string (such as "\t" or "  ").
 */
export function multilineLayout(tab: string): LayoutStrategy {
  function strategy(indentLevel: number) {
    return {
      atom: (line: string) => {
        const indentation = Array(indentLevel).fill(tab).join("");
        return indentation + line;
      },
      join: (xs: string[]) => xs.join("\n"),
      next: () => strategy(indentLevel + 1),
    };
  }
  return strategy(0);
}

/**
 * Create a layout strategy that lays out all text on one line.
 */
export function inlineLayout(): LayoutStrategy {
  const result = {
    atom: (line) => line,
    join: (xs) => xs.join(" "),
    next: () => result,
  };
  return result;
}

/*
 * Map a stringification function across a list, and join the results
 * with a formatter.
 */
function formatList<T>(
  values: T[],
  subformatter: (value: T, ls: LayoutStrategy) => string,
  ls: LayoutStrategy
): string {
  return ls.join(values.map((x) => subformatter(x, ls)));
}

/*
 * Map a stringification function across the values of an object, and
 * join the keys and their corresponding results with a formatter.
 */
function formatObject<T>(
  object: {[string]: T},
  subformatter: (value: T, ls: LayoutStrategy) => string,
  ls: LayoutStrategy
): string {
  function formatKey(k: string, ls: LayoutStrategy): string {
    return ls.join([ls.atom(`${k}:`), subformatter(object[k], ls.next())]);
  }
  return formatList(Object.keys(object), formatKey, ls);
}

export const stringify = {
  body(body: Body, ls: LayoutStrategy): string {
    return formatList(body, stringify.definition, ls);
  },

  definition(definition: Definition, ls: LayoutStrategy): string {
    switch (definition.type) {
      case "QUERY":
        return stringify.queryDefinition(definition, ls);
      case "FRAGMENT":
        return stringify.fragmentDefinition(definition, ls);
      // istanbul ignore next: unreachable per Flow
      default:
        throw new Error(`Unknown definition type: ${(definition.type: empty)}`);
    }
  },

  queryDefinition(query: QueryDefinition, ls: LayoutStrategy): string {
    const paramsPart = (() => {
      if (query.params.length === 0) {
        return "";
      } else {
        const items = formatList(
          query.params,
          stringify.parameter,
          inlineLayout()
        );
        return `(${items})`;
      }
    })();
    const selectionsPart = formatList(
      query.selections,
      stringify.selection,
      ls.next()
    );
    return ls.join([
      ls.atom(`query ${query.name}${paramsPart} {`),
      selectionsPart,
      ls.atom("}"),
    ]);
  },

  parameter(parameter: Parameter, ls: LayoutStrategy): string {
    return ls.atom(`$${parameter.name}: ${parameter.type}`);
  },

  fragmentDefinition(fragment: FragmentDefinition, ls: LayoutStrategy): string {
    const selectionsPart = formatList(
      fragment.selections,
      stringify.selection,
      ls.next()
    );
    return ls.join([
      ls.atom(`fragment ${fragment.name} on ${fragment.typeCondition} {`),
      selectionsPart,
      ls.atom("}"),
    ]);
  },

  selection(selection: Selection, ls: LayoutStrategy): string {
    switch (selection.type) {
      case "FIELD":
        return stringify.field(selection, ls);
      case "FRAGMENT_SPREAD":
        return stringify.fragmentSpread(selection, ls);
      case "INLINE_FRAGMENT":
        return stringify.inlineFragment(selection, ls);
      // istanbul ignore next: unreachable per Flow
      default:
        throw new Error(`Unknown selection type: ${(selection.type: empty)}`);
    }
  },

  field(field: Field, ls: LayoutStrategy): string {
    const aliasPart = (() => {
      if (field.alias == null) {
        return "";
      } else {
        return `${field.alias}: `;
      }
    })();
    const argsPart = (() => {
      if (Object.keys(field.args).length === 0) {
        return "";
      } else {
        const args = formatObject(field.args, stringify.value, inlineLayout());
        return `(${args})`;
      }
    })();
    if (field.selections.length === 0) {
      return ls.atom(`${field.name}${argsPart}`);
    } else {
      const selectionsPart = formatList(
        field.selections,
        stringify.selection,
        ls.next()
      );
      return ls.join([
        ls.atom(`${aliasPart}${field.name}${argsPart} {`),
        selectionsPart,
        ls.atom("}"),
      ]);
    }
  },

  fragmentSpread(fs: FragmentSpread, ls: LayoutStrategy): string {
    return ls.atom(`...${fs.fragmentName}`);
  },

  inlineFragment(fragment: InlineFragment, ls: LayoutStrategy): string {
    const typeConditionPart =
      fragment.typeCondition == null ? "" : ` on ${fragment.typeCondition}`;
    const selectionsPart = formatList(
      fragment.selections,
      stringify.selection,
      ls.next()
    );
    return ls.join([
      ls.atom(`...${typeConditionPart} {`),
      selectionsPart,
      ls.atom("}"),
    ]);
  },

  value(value: Value, ls: LayoutStrategy): string {
    switch (value.type) {
      case "VARIABLE":
        return stringify.variableValue(value, ls);
      case "LITERAL":
        return stringify.literalValue(value, ls);
      case "ENUM":
        return stringify.enumValue(value, ls);
      case "LIST":
        return stringify.listValue(value, ls);
      case "OBJECT":
        return stringify.objectValue(value, ls);
      // istanbul ignore next: unreachable per Flow
      default:
        throw new Error(`Unknown value type: ${(value.type: empty)}`);
    }
  },

  variableValue(value: VariableValue, ls: LayoutStrategy): string {
    return ls.atom(`$${value.data}`);
  },

  literalValue(value: LiteralValue, ls: LayoutStrategy): string {
    return ls.atom(JSON.stringify(value.data));
  },

  enumValue(value: EnumValue, ls: LayoutStrategy): string {
    return ls.atom(value.data);
  },

  listValue(value: ListValue, ls: LayoutStrategy): string {
    return ls.join([
      ls.atom("["),
      formatList(value.data, stringify.value, ls.next()),
      ls.atom("]"),
    ]);
  },

  objectValue(value: ObjectValue, ls: LayoutStrategy): string {
    return ls.join([
      ls.atom("{"),
      formatObject(value.data, stringify.value, ls.next()),
      ls.atom("}"),
    ]);
  },
};
