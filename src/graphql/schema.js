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
  | {|+type: "OBJECT", +fields: {|+[Fieldname]: FieldType|}|}
  | {|+type: "UNION", +clauses: {|+[Typename]: true|}|};

export type FieldType =
  | IdFieldType
  | PrimitiveFieldType
  | NodeFieldType
  | ConnectionFieldType
  | NestedFieldType;
export type IdFieldType = {|+type: "ID"|};
export type PrimitiveFieldType = {|+type: "PRIMITIVE"|};
export type NodeFieldType = {|+type: "NODE", +elementType: Typename|};
export type ConnectionFieldType = {|
  +type: "CONNECTION",
  +elementType: Typename,
|};
export type NestedFieldType = {|
  +type: "NESTED",
  +eggs: {+[Fieldname]: PrimitiveFieldType | NodeFieldType},
|};

// Every object must have exactly one `id` field, and it must have this
// name.
const ID_FIELD_NAME = "id";

export function schema(types: {[Typename]: NodeType}): Schema {
  const result = {};
  for (const typename of Object.keys(types)) {
    const type = types[typename];
    switch (type.type) {
      case "OBJECT":
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
  return {type: "OBJECT", fields: {...fields}};
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

export function primitive(): PrimitiveFieldType {
  return {type: "PRIMITIVE"};
}

export function node(elementType: Typename): NodeFieldType {
  return {type: "NODE", elementType};
}

export function connection(elementType: Typename): ConnectionFieldType {
  return {type: "CONNECTION", elementType};
}

export function nested(eggs: {
  +[Fieldname]: PrimitiveFieldType | NodeFieldType,
}): NestedFieldType {
  return {type: "NESTED", eggs: {...eggs}};
}
