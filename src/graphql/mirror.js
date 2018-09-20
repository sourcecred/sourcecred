// @flow

import type Database from "better-sqlite3";
import stringify from "json-stable-stringify";

import dedent from "../util/dedent";
import * as Schema from "./schema";

/**
 * A local mirror of a subset of a GraphQL database.
 */
export class Mirror {
  +_db: Database;
  +_schema: Schema.Schema;
  +_schemaInfo: SchemaInfo;

  /**
   * Create a GraphQL mirror using the given database connection and
   * GraphQL schema.
   *
   * The connection must be to a database that either (a) is empty and
   * unused, or (b) has been previously used for a GraphQL mirror with
   * an identical GraphQL schema. The database attached to the
   * connection must not be modified by any other clients. In other
   * words, passing a connection to this constructor entails transferring
   * ownership of the attached database to this module.
   *
   * If the database attached to the connection has been used with an
   * incompatible GraphQL schema or an outdated version of this module,
   * an error will be thrown and the database will remain unmodified.
   */
  constructor(db: Database, schema: Schema.Schema): void {
    if (db == null) throw new Error("db: " + String(db));
    if (schema == null) throw new Error("schema: " + String(schema));
    this._db = db;
    this._schema = schema;
    this._schemaInfo = _buildSchemaInfo(this._schema);
    this._initialize();
  }

  /**
   * Embed the GraphQL schema into the database, initializing it for use
   * as a mirror.
   *
   * This method should only be invoked once, at construction time.
   *
   * If the database has already been initialized with the same schema
   * and version, no action is taken and no error is thrown. If the
   * database has been initialized with a different schema or version,
   * the database is left unchanged, and an error is thrown.
   *
   * A discussion of the database structure follows.
   *
   * ---
   *
   * Objects have three kinds of fields: connections, links, and
   * primitives (plus an ID, which we ignore for now). The database has
   * a single `connections` table for all objects, and also a single
   * `links` table for all objects. For primitives, each GraphQL data
   * type has its own table, and each object of that type has a row in
   * the corresponding table.
   *
   * In more detail:
   *   - The `connections` table has a row for each `(id, fieldname)`
   *     pair, where `fieldname` is the name of a connection field on the
   *     object with the given ID. This stores metadata about the
   *     connection: its total count, when it was last updated, etc. It
   *     does not store the actual entries in the connection (the nodes
   *     that the connection points to); `connection_entries` stores
   *     these.
   *   - The `links` table has a row for each `(id, fieldname)` pair,
   *     where `fieldname` is the name of a link field on the object
   *     with the given ID. This simply points to the referenced object.
   *   - For each type `T`, the `primitives_T` table has one row for
   *     each object of type `T`, storing the primitive data of the
   *     object.
   *
   * We refer to node and primitive data together as "own data", because
   * this is the data that can be queried uniformly for all elements of
   * a type; querying connection data, by contrast, requires the
   * object-specific end cursor.
   *
   * All aforementioned tables are keyed by object ID. Each object also
   * appears once in the `objects` table, which relates its ID,
   * typename, and last own-data update. Each connection has its own
   * last-update value, because connections can be updated independently
   * of each other and of own-data.
   *
   * Note that any object in the database should have entries in the
   * `connections` and `links` table for all relevant fields, as well as
   * an entry in the relevant primitives table, even if the node has
   * never been updated. This is for convenience of implementation: it
   * means that the first fetch for a node is the same as subsequent
   * fetches (a SQL `UPDATE` instead of first requiring an existence
   * check).
   *
   * Finally, a table `meta` is used to store metadata about the mirror
   * itself. This is used to make sure that the mirror is not loaded
   * with an incompatible version of the code or schema. It is never
   * updated after it is first set.
   */
  _initialize() {
    // The following version number must be updated if there is any
    // change to the way in which a GraphQL schema is mapped to a SQL
    // schema or the way in which the resulting SQL schema is
    // interpreted. If you've made a change and you're not sure whether
    // it requires bumping the version, bump it: requiring some extra
    // one-time cache resets is okay; doing the wrong thing is not.
    const blob = stringify({version: "MIRROR_v1", schema: this._schema});
    const db = this._db;
    _inTransaction(db, () => {
      // We store the metadata in a singleton table `meta`, whose unique row
      // has primary key `0`. Only the first ever insert will succeed; we
      // are locked into the first schema.
      db.prepare(
        dedent`\
          CREATE TABLE IF NOT EXISTS meta (
              zero INTEGER PRIMARY KEY,
              schema TEXT NOT NULL
          )
        `
      ).run();

      const existingBlob: string | void = db
        .prepare("SELECT schema FROM meta")
        .pluck()
        .get();
      if (existingBlob === blob) {
        // Already set up; nothing to do.
        return;
      } else if (existingBlob !== undefined) {
        throw new Error(
          "Database already populated with incompatible schema or version"
        );
      }
      db.prepare("INSERT INTO meta (zero, schema) VALUES (0, ?)").run(blob);

      // First, create those tables that are independent of the schema.
      const structuralTables = [
        // Time is stored in milliseconds since 1970-01-01T00:00Z, with
        // ECMAScript semantics (leap seconds ignored, exactly 86.4M ms
        // per day, etc.).
        //
        // We use milliseconds rather than seconds because (a) this
        // simplifies JavaScript interop to a simple `+new Date()` and
        // `new Date(value)`, and (b) this avoids a lurking Year 2038
        // problem by surfacing >32-bit values immediately. (We have
        // over 200,000 years before the number of milliseconds since
        // epoch is more than `Number.MAX_SAFE_INTEGER`.)
        dedent`\
          CREATE TABLE updates (
              rowid INTEGER PRIMARY KEY,
              time_epoch_millis INTEGER NOT NULL
          )
        `,
        dedent`\
          CREATE TABLE objects (
              id TEXT NOT NULL PRIMARY KEY,
              typename TEXT NOT NULL,
              last_update INTEGER,
              FOREIGN KEY(last_update) REFERENCES updates(rowid)
          )
        `,
        dedent`\
          CREATE TABLE links (
              rowid INTEGER PRIMARY KEY,
              parent_id TEXT NOT NULL,
              fieldname TEXT NOT NULL,
              child_id TEXT,
              UNIQUE(parent_id, fieldname),
              FOREIGN KEY(parent_id) REFERENCES objects(id),
              FOREIGN KEY(child_id) REFERENCES objects(id)
          )
        `,
        dedent`\
          CREATE UNIQUE INDEX idx_links__parent_id__fieldname
          ON links (parent_id, fieldname)
        `,
        dedent`\
          CREATE TABLE connections (
              rowid INTEGER PRIMARY KEY,
              object_id TEXT NOT NULL,
              fieldname TEXT NOT NULL,
              last_update INTEGER,
              -- Each of the below fields must be NULL if the connection
              -- has never been updated.
              total_count INTEGER,
              has_next_page BOOLEAN,
              -- The end cursor may be NULL if no items are in the connection;
              -- this is a consequence of GraphQL and the Relay pagination spec.
              -- (It may also be NULL if the connection was never updated.)
              end_cursor TEXT,
              CHECK((last_update IS NULL) = (total_count IS NULL)),
              CHECK((last_update IS NULL) = (has_next_page IS NULL)),
              CHECK((last_update IS NULL) <= (end_cursor IS NULL)),
              UNIQUE(object_id, fieldname),
              FOREIGN KEY(object_id) REFERENCES objects(id),
              FOREIGN KEY(last_update) REFERENCES updates(rowid)
          )
        `,
        dedent`\
          CREATE UNIQUE INDEX idx_connections__object_id__fieldname
          ON connections (object_id, fieldname)
        `,
        dedent`\
          CREATE TABLE connection_entries (
              rowid INTEGER PRIMARY KEY,
              connection_id INTEGER NOT NULL,
              idx INTEGER NOT NULL,  -- impose an ordering
              child_id TEXT,
              UNIQUE(connection_id, idx),
              FOREIGN KEY(connection_id) REFERENCES connections(rowid),
              FOREIGN KEY(child_id) REFERENCES objects(id)
          )
        `,
        dedent`\
          CREATE INDEX idx_connection_entries__connection_id
          ON connection_entries (connection_id)
        `,
      ];
      for (const sql of structuralTables) {
        db.prepare(sql).run();
      }

      // Then, create primitive-data tables, which depend on the schema.
      // We only create tables for object types, as union types have no
      // physical representation; they exist only at the type level.
      for (const typename of Object.keys(this._schemaInfo.objectTypes)) {
        const type = this._schemaInfo.objectTypes[typename];
        if (!isSqlSafe(typename)) {
          throw new Error(
            "invalid object type name: " + JSON.stringify(typename)
          );
        }
        for (const fieldname of type.primitiveFieldNames) {
          if (!isSqlSafe(fieldname)) {
            throw new Error("invalid field name: " + JSON.stringify(fieldname));
          }
        }
        const tableName = _primitivesTableName(typename);
        const tableSpec = [
          "id TEXT NOT NULL PRIMARY KEY",
          ...type.primitiveFieldNames.map((fieldname) => `"${fieldname}"`),
          "FOREIGN KEY(id) REFERENCES objects(id)",
        ].join(", ");
        db.prepare(`CREATE TABLE ${tableName} (${tableSpec})`).run();
      }
    });
  }

  /**
   * Register a new update, representing one communication with the
   * remote server. A unique ID will be created and returned.
   */
  _createUpdate(updateTimestamp: Date): UpdateId {
    return this._db
      .prepare("INSERT INTO updates (time_epoch_millis) VALUES (?)")
      .run(+updateTimestamp).lastInsertROWID;
  }

  /**
   * Inform the GraphQL mirror of the existence of an object. The
   * object's name and concrete type must be specified. The concrete
   * type must be an OBJECT type in the GraphQL schema.
   *
   * If the object has previously been registered with the same type, no
   * action is taken and no error is raised. If the object has
   * previously been registered with a different type, an error is
   * thrown, and the database is left unchanged.
   */
  registerObject(object: {|
    +typename: Schema.Typename,
    +id: Schema.ObjectId,
  |}): void {
    _inTransaction(this._db, () => {
      this._nontransactionallyRegisterObject(object);
    });
  }

  /**
   * As `registerObject`, but do not enter any transactions. Other
   * methods may call this method as a subroutine in a larger
   * transaction.
   */
  _nontransactionallyRegisterObject(object: {|
    +typename: Schema.Typename,
    +id: Schema.ObjectId,
  |}): void {
    const db = this._db;
    const {typename, id} = object;

    const existingTypename = db
      .prepare("SELECT typename FROM objects WHERE id = ?")
      .pluck()
      .get(id);
    if (existingTypename === typename) {
      // Already registered; nothing to do.
      return;
    } else if (existingTypename !== undefined) {
      const s = JSON.stringify;
      throw new Error(
        `Inconsistent type for ID ${s(id)}: ` +
          `expected ${s(existingTypename)}, got ${s(typename)}`
      );
    }

    if (this._schema[typename] == null) {
      throw new Error("Unknown type: " + JSON.stringify(typename));
    }
    if (this._schema[typename].type !== "OBJECT") {
      throw new Error(
        "Cannot add object of non-object type: " +
          `${JSON.stringify(typename)} (${this._schema[typename].type})`
      );
    }

    this._db
      .prepare(
        dedent`\
          INSERT INTO objects (id, last_update, typename)
          VALUES (:id, NULL, :typename)
        `
      )
      .run({id, typename});
    this._db
      .prepare(
        dedent`\
          INSERT INTO ${_primitivesTableName(typename)} (id)
          VALUES (?)
        `
      )
      .run(id);
    const addLink = this._db.prepare(
      dedent`\
        INSERT INTO links (parent_id, fieldname, child_id)
        VALUES (:id, :fieldname, NULL)
      `
    );
    const addConnection = this._db.prepare(
      // These fields are initialized to NULL because there has
      // been no update and so they have no meaningful values:
      // last_update, total_count, has_next_page, end_cursor.
      dedent`\
        INSERT INTO connections (object_id, fieldname)
        VALUES (:id, :fieldname)
      `
    );
    const objectType = this._schemaInfo.objectTypes[typename];
    for (const fieldname of objectType.linkFieldNames) {
      addLink.run({id, fieldname});
    }
    for (const fieldname of objectType.connectionFieldNames) {
      addConnection.run({id, fieldname});
    }
  }
}

/**
 * Decomposition of a schema, grouping types by their kind (object vs.
 * union) and object fields by their kind (primitive vs. link vs.
 * connection).
 *
 * All arrays contain elements in arbitrary order.
 */
type SchemaInfo = {|
  +objectTypes: {|
    +[Schema.Typename]: {|
      +fields: {|+[Schema.Fieldname]: Schema.FieldType|},
      +primitiveFieldNames: $ReadOnlyArray<Schema.Fieldname>,
      +linkFieldNames: $ReadOnlyArray<Schema.Fieldname>,
      +connectionFieldNames: $ReadOnlyArray<Schema.Fieldname>,
      // There is always exactly one ID field, so it needs no
      // special representation. (It's still included in the `fields`
      // dictionary, though.)
    |},
  |},
  +unionTypes: {|
    +[Schema.Fieldname]: {|
      +clauses: $ReadOnlyArray<Schema.Typename>,
    |},
  |},
|};

export function _buildSchemaInfo(schema: Schema.Schema): SchemaInfo {
  const result = {
    objectTypes: (({}: any): {|
      [Schema.Typename]: {|
        +fields: {|+[Schema.Fieldname]: Schema.FieldType|},
        +primitiveFieldNames: Array<Schema.Fieldname>,
        +linkFieldNames: Array<Schema.Fieldname>,
        +connectionFieldNames: Array<Schema.Fieldname>,
      |},
    |}),
    unionTypes: (({}: any): {|
      [Schema.Fieldname]: {|
        +clauses: $ReadOnlyArray<Schema.Typename>,
      |},
    |}),
  };
  for (const typename of Object.keys(schema)) {
    const type = schema[typename];
    switch (type.type) {
      case "OBJECT": {
        const entry: {|
          +fields: {|+[Schema.Fieldname]: Schema.FieldType|},
          +primitiveFieldNames: Array<Schema.Fieldname>,
          +linkFieldNames: Array<Schema.Fieldname>,
          +connectionFieldNames: Array<Schema.Fieldname>,
        |} = {
          fields: type.fields,
          primitiveFieldNames: [],
          linkFieldNames: [],
          connectionFieldNames: [],
        };
        result.objectTypes[typename] = entry;
        for (const fieldname of Object.keys(type.fields)) {
          const field = type.fields[fieldname];
          switch (field.type) {
            case "ID":
              break;
            case "PRIMITIVE":
              entry.primitiveFieldNames.push(fieldname);
              break;
            case "NODE":
              entry.linkFieldNames.push(fieldname);
              break;
            case "CONNECTION":
              entry.connectionFieldNames.push(fieldname);
              break;
            // istanbul ignore next
            default:
              throw new Error((field.type: empty));
          }
        }
        break;
      }
      case "UNION": {
        const entry = {clauses: Object.keys(type.clauses)};
        result.unionTypes[typename] = entry;
        break;
      }
      // istanbul ignore next
      default:
        throw new Error((type.type: empty));
    }
  }
  return result;
}

type UpdateId = number;

/**
 * Execute a function inside a database transaction.
 *
 * The database must not be in a transaction. A new transaction will be
 * entered, and then the callback will be invoked.
 *
 * If the callback completes normally, then its return value is passed
 * up to the caller, and the currently active transaction (if any) is
 * committed.
 *
 * If the callback throws an error, then the error is propagated to the
 * caller, and the currently active transaction (if any) is rolled back.
 *
 * Note that the callback may choose to commit or roll back the
 * transaction before returning or throwing an error. Conversely, note
 * that if the callback commits the transaction, and then begins a new
 * transaction but does not end it, then this function will commit the
 * new transaction if the callback returns (or roll it back if it
 * throws).
 */
export function _inTransaction<R>(db: Database, fn: () => R): R {
  if (db.inTransaction) {
    throw new Error("already in transaction");
  }
  try {
    db.prepare("BEGIN").run();
    const result = fn();
    if (db.inTransaction) {
      db.prepare("COMMIT").run();
    }
    return result;
  } finally {
    if (db.inTransaction) {
      db.prepare("ROLLBACK").run();
    }
  }
}

/*
 * In some cases, we need to interpolate user input in SQL queries in
 * positions that do not allow bound variables in prepared statements
 * (e.g., table and column names). In these cases, we manually sanitize.
 *
 * If this function returns `true`, then its argument may be safely
 * included in a SQL identifier. If it returns `false`, then no such
 * guarantee is made (this function is overly conservative, so it is
 * possible that the argument may in fact be safe).
 *
 * For instance, the function will return `true` if passed "col", but
 * will return `false` if passed "'); DROP TABLE objects; --".
 */
function isSqlSafe(token: string) {
  return !token.match(/[^A-Za-z0-9_]/);
}

/**
 * Get the name of the table used to store primitive data for objects of
 * the given type, which should be SQL-safe lest an error be thrown.
 *
 * Note that the resulting string is double-quoted.
 */
function _primitivesTableName(typename: Schema.Typename) {
  // istanbul ignore if
  if (!isSqlSafe(typename)) {
    // This shouldn't be reachable---we should have caught it earlier.
    // But checking it anyway is cheap.
    throw new Error(
      "Invariant violation: invalid object type name " +
        JSON.stringify(typename)
    );
  }
  return `"primitives_${typename}"`;
}
