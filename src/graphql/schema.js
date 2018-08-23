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
export type Schema = {+[Typename]: NodeType};
export type NodeType =
  | {|+type: "OBJECT", +fields: {+[Fieldname]: FieldType}|}
  | {|+type: "UNION", +clauses: {+[Typename]: true}|};
export type FieldType =
  | {|+type: "ID"|}
  | {|+type: "PRIMITIVE"|}
  | {|+type: "NODE", +elementType: Typename|}
  | {|+type: "CONNECTION", +elementType: Typename|};

// Every object must have exactly one `id` field, and it must have this
// name.
const ID_FIELD_NAME = "id";

export function schema(types: {[Typename]: NodeType}): Schema {
  return {...types};
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
  const clausesMap = {};
  for (const clause of clauses) {
    if (clausesMap[clause] != null) {
      throw new Error(`duplicate union clause: "${clause}"`);
    }
    clausesMap[clause] = true;
  }
  return {type: "UNION", clauses: clausesMap};
}

export function id(): FieldType {
  return {type: "ID"};
}

export function primitive(): FieldType {
  return {type: "PRIMITIVE"};
}

export function node(elementType: Typename): FieldType {
  return {type: "NODE", elementType};
}

export function connection(elementType: Typename): FieldType {
  return {type: "CONNECTION", elementType};
}
