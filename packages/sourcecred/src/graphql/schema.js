// @flow

/**
 * Data types to describe a particular subset of GraphQL schemata.
 * Schemata represented by this module must satisfy these constraints:
 *
 *   - Every object must have an `id` field of primitive type.
 *   - Every field of an object must be either a primitive, a reference
 *     to a single (possibly nullable) object, or a _connection_ as
 *     described in the Relay cursor connections specification. In
 *     particular, no field may directly contain a list.
 *   - Interface types must be represented as unions of all their
 *     implementations.
 */

// The name of a GraphQL type, like `Repository` or `Int`.
export type Typename = string;

// The name of a GraphQL object field, like `name` or `pullRequests`.
export type Fieldname = string;

// The database-wide unique ID of a GraphQL object.
export type ObjectId = string;

// Description of a GraphQL schema. Types are represented as follows:
//   - An object type is represented directly as an `OBJECT`.
//   - A union type is represented directly as a `UNION`.
//   - An interface type is represented as a `UNION` of all its
//     implementations.
//   - Scalars and enums may only occur as object fields, and are
//     represented as `PRIMITIVE`s (except for `ID`s).
//   - Connections are supported as object fields, but arbitrary lists
//     are not.
//
// Primitive and enum fields on an object type may optionally be
// annotated with their representations.
//
// To accommodate schemata where some object types do not have IDs,
// objects may have "nested" fields of primitive or node-reference type.
// These may be nested to depth exactly 1. Suppose that `Foo` is an
// object type that includes `bar: Bar!`, but `Bar` is an object type
// without an `id`. Then `Bar` may not be a first-class type, but `Foo`
// may pull properties off of it using
//
//     bar: nested({x: primitive(), y: node("Baz")});
//
// The property "bar" in the above example is called a _nested_
// property, and its fields "x" and "y" are called _eggs_. (The nest
// contains the eggs.)
export type Schema = {+[Typename]: NodeType};
export type NodeType =
  | {|+type: "SCALAR", +representation: "string" | "number" | "boolean"|}
  | {|+type: "ENUM", +values: {|+[string]: true|}|}
  | {|+type: "OBJECT", +fields: {|+[Fieldname]: FieldType|}|}
  | {|+type: "UNION", +clauses: {|+[Typename]: true|}|};

export type FieldType =
  | IdFieldType
  | PrimitiveFieldType
  | NodeFieldType
  | ConnectionFieldType
  | NestedFieldType;
export type IdFieldType = {|+type: "ID"|};
export type PrimitiveFieldType = {|
  +type: "PRIMITIVE",
  +annotation: null | PrimitiveTypeAnnotation,
|};
export type PrimitiveTypeAnnotation = {|
  +nonNull: boolean,
  +elementType: Typename,
|};
export type NodeFieldType = {|
  +type: "NODE",
  +elementType: Typename,
  +fidelity: Fidelity,
|};
export type ConnectionFieldType = {|
  +type: "CONNECTION",
  +elementType: Typename,
  +fidelity: Fidelity,
|};
export type NestedFieldType = {|
  +type: "NESTED",
  +eggs: {+[Fieldname]: PrimitiveFieldType | NodeFieldType},
|};

// A field is _faithful_ if selecting its `__typename` and `id` will
// always yield the correct `__typename` for the node of the given ID.
// In theory, this should always be the case, but some remote schemas
// are broken. For details, see:
//
//   - https://github.com/sourcecred/sourcecred/issues/996
//   - https://github.com/sourcecred/sourcecred/issues/998
//
// For an unfaithful field, the `actualTypenames` property lists all the
// types of objects that can _actually_ be returned when the field is
// queried. (This set only affects generated Flow types, not runtime
// semantics.) These must all be object types.
//
// It is always sound to represent an actually-faithful field as
// unfaithful, but doing so may incur additional queries. Marking a type
// as faithful should be seen as an optimization that may be performed
// only when the server is abiding by its contract for that field.
export type Fidelity =
  | {|+type: "FAITHFUL"|}
  | {|+type: "UNFAITHFUL", actualTypenames: {|+[Typename]: true|}|};

export function faithful(): Fidelity {
  return {type: "FAITHFUL"};
}

export function unfaithful(
  actualTypenames: $ReadOnlyArray<Typename>
): Fidelity {
  const actualTypenamesObject: {|[Typename]: true|} = ({}: any);
  for (const t of actualTypenames) {
    actualTypenamesObject[t] = true;
  }
  return {type: "UNFAITHFUL", actualTypenames: actualTypenamesObject};
}

// Every object must have exactly one `id` field, and it must have this
// name.
const ID_FIELD_NAME = "id";

export function schema(types: {[Typename]: NodeType}): Schema {
  function assertKind(
    path,
    elementTypename,
    validKinds,
    {isFidelity = false} = {}
  ) {
    const self =
      (isFidelity ? "unfaithful typenames list of " : "") +
      `field ${path.map((x) => JSON.stringify(x)).join("/")}`;
    const elementType = types[elementTypename];
    if (elementType == null) {
      throw new Error(`${self} has unknown type: "${elementTypename}"`);
    }
    if (!validKinds.includes(elementType.type)) {
      throw new Error(
        `${self} has invalid type "${elementTypename}" ` +
          `of kind "${elementType.type}"`
      );
    }
  }
  function validateFidelity(path, fidelity) {
    switch (fidelity.type) {
      case "FAITHFUL":
        break;
      case "UNFAITHFUL":
        for (const typename of Object.keys(fidelity.actualTypenames)) {
          assertKind(path, typename, ["OBJECT"], {isFidelity: true});
        }
        break;
      // istanbul ignore next: unreachable per Flow
      default:
        throw new Error((fidelity.type: empty));
    }
  }
  const result = {};
  for (const typename of Object.keys(types)) {
    const type = types[typename];
    switch (type.type) {
      case "SCALAR":
        result[typename] = {
          type: "SCALAR",
          representation: type.representation,
        };
        break;
      case "ENUM":
        result[typename] = {type: "ENUM", values: {...type.values}};
        break;
      case "OBJECT":
        for (const fieldname of Object.keys(type.fields)) {
          const field = type.fields[fieldname];
          switch (field.type) {
            case "ID":
              // Nothing to check.
              break;
            case "PRIMITIVE":
              if (field.annotation != null) {
                assertKind(
                  [typename, fieldname],
                  field.annotation.elementType,
                  ["SCALAR", "ENUM"]
                );
              }
              break;
            case "NODE":
              assertKind([typename, fieldname], field.elementType, [
                "OBJECT",
                "UNION",
              ]);
              validateFidelity([typename, fieldname], field.fidelity);
              break;
            case "CONNECTION":
              assertKind([typename, fieldname], field.elementType, [
                "OBJECT",
                "UNION",
              ]);
              validateFidelity([typename, fieldname], field.fidelity);
              break;
            case "NESTED":
              for (const eggName of Object.keys(field.eggs)) {
                const egg = field.eggs[eggName];
                switch (egg.type) {
                  case "PRIMITIVE":
                    if (egg.annotation != null) {
                      assertKind(
                        [typename, fieldname, eggName],
                        egg.annotation.elementType,
                        ["SCALAR", "ENUM"]
                      );
                    }
                    break;
                  case "NODE":
                    assertKind(
                      [typename, fieldname, eggName],
                      egg.elementType,
                      ["OBJECT", "UNION"]
                    );
                    validateFidelity(
                      [typename, fieldname, eggName],
                      egg.fidelity
                    );
                    break;
                  // istanbul ignore next: unreachable per Flow
                  default:
                    throw new Error((egg.type: empty));
                }
              }
              break;
            // istanbul ignore next: unreachable per Flow
            default:
              throw new Error((field.type: empty));
          }
        }
        result[typename] = {type: "OBJECT", fields: {...type.fields}};
        break;
      case "UNION":
        for (const clause of Object.keys(type.clauses)) {
          const clauseType = types[clause];
          if (clauseType == null) {
            throw new Error(
              `union has unknown clause: "${typename}"/"${clause}"`
            );
          }
          if (clauseType.type !== "OBJECT") {
            // The GraphQL spec doesn't permit unions of interfaces or
            // other unions (or primitives). This is nice, because it
            // means that we don't have to worry about ill-founded
            // unions.
            throw new Error(
              `union has non-object type clause: "${typename}"/"${clause}"`
            );
          }
        }
        result[typename] = {type: "UNION", clauses: {...type.clauses}};
        break;
      // istanbul ignore next
      default:
        throw new Error((type.type: empty));
    }
  }
  return result;
}

export function scalar(
  representation: "string" | "number" | "boolean"
): NodeType {
  return {type: "SCALAR", representation};
}

function enum_(values: $ReadOnlyArray<string>): NodeType {
  const valuesObject: {|[string]: true|} = ({}: any);
  for (const v of values) {
    valuesObject[v] = true;
  }
  return {type: "ENUM", values: valuesObject};
}
export {enum_ as enum};

export function object(fields: {[Fieldname]: FieldType}): NodeType {
  for (const fieldname of Object.keys(fields)) {
    const field = fields[fieldname];
    if (fieldname === "__typename") {
      throw new Error("reserved field name: " + fieldname);
    }
    if (field.type === "ID" && fieldname !== ID_FIELD_NAME) {
      throw new Error(`invalid ID field with name "${fieldname}"`);
    }
  }
  if (fields[ID_FIELD_NAME] == null) {
    throw new Error(`expected ID field with name "${ID_FIELD_NAME}"`);
  }
  if (fields[ID_FIELD_NAME].type !== "ID") {
    throw new Error(`field "${ID_FIELD_NAME}" must be an ID field`);
  }
  // Workaround for <https://github.com/facebook/flow/issues/7128>.
  const exactFields: {|[Fieldname]: FieldType|} = ({...fields}: any);
  return {type: "OBJECT", fields: exactFields};
}

export function union(clauses: $ReadOnlyArray<Typename>): NodeType {
  const clausesMap: {|[Typename]: true|} = ({}: any);
  for (const clause of clauses) {
    if (clausesMap[clause] != null) {
      throw new Error(`duplicate union clause: "${clause}"`);
    }
    clausesMap[clause] = true;
  }
  return {type: "UNION", clauses: clausesMap};
}

export function id(): IdFieldType {
  return {type: "ID"};
}

export function primitive(
  annotation?: PrimitiveTypeAnnotation
): PrimitiveFieldType {
  return {type: "PRIMITIVE", annotation: annotation || null};
}

export function node(
  elementType: Typename,
  fidelity: Fidelity = faithful()
): NodeFieldType {
  return {type: "NODE", elementType, fidelity};
}

export function connection(
  elementType: Typename,
  fidelity: Fidelity = faithful()
): ConnectionFieldType {
  return {type: "CONNECTION", elementType, fidelity};
}

export function nonNull(elementType: Typename): PrimitiveTypeAnnotation {
  return {nonNull: true, elementType};
}

export function nullable(elementType: Typename): PrimitiveTypeAnnotation {
  return {nonNull: false, elementType};
}

export function nested(eggs: {
  +[Fieldname]: PrimitiveFieldType | NodeFieldType,
}): NestedFieldType {
  return {type: "NESTED", eggs: {...eggs}};
}
