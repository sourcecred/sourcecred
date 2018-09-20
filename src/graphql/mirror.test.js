// @flow

import Database from "better-sqlite3";
import fs from "fs";
import tmp from "tmp";

import * as Schema from "./schema";
import {_buildSchemaInfo, _inTransaction, Mirror} from "./mirror";

describe("graphql/mirror", () => {
  function buildGithubSchema(): Schema.Schema {
    const s = Schema;
    return s.schema({
      Repository: s.object({
        id: s.id(),
        url: s.primitive(),
        issues: s.connection("Issue"),
      }),
      Issue: s.object({
        id: s.id(),
        url: s.primitive(),
        author: s.node("Actor"),
        parent: s.node("Repository"),
        title: s.primitive(),
        comments: s.connection("IssueComment"),
      }),
      IssueComment: s.object({
        id: s.id(),
        body: s.primitive(),
        author: s.node("Actor"),
      }),
      Actor: s.union(["User", "Bot", "Organization"]), // actually an interface
      User: s.object({
        id: s.id(),
        url: s.primitive(),
        login: s.primitive(),
      }),
      Bot: s.object({
        id: s.id(),
        url: s.primitive(),
        login: s.primitive(),
      }),
      Organization: s.object({
        id: s.id(),
        url: s.primitive(),
        login: s.primitive(),
      }),
    });
  }

  describe("Mirror", () => {
    describe("constructor", () => {
      it("initializes a new database successfully", () => {
        const db = new Database(":memory:");
        const schema = buildGithubSchema();
        expect(() => new Mirror(db, schema)).not.toThrow();
      });

      it("fails if the database connection is `null`", () => {
        // $ExpectFlowError
        expect(() => new Mirror(null, buildGithubSchema())).toThrow("db: null");
      });

      it("fails if the schema is `null`", () => {
        // $ExpectFlowError
        expect(() => new Mirror(new Database(":memory:"), null)).toThrow(
          "schema: null"
        );
      });

      it("creates the right set of tables", () => {
        const db = new Database(":memory:");
        const schema = buildGithubSchema();
        new Mirror(db, schema);
        const tables = db
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
          .pluck()
          .all();
        expect(tables.sort()).toEqual(
          [
            // Structural tables
            "meta",
            "updates",
            "objects",
            "links",
            "connections",
            "connection_entries",
            // Primitive data tables per OBJECT type (no UNIONs)
            "primitives_Repository",
            "primitives_Issue",
            "primitives_IssueComment",
            "primitives_User",
            "primitives_Bot",
            "primitives_Organization",
          ].sort()
        );
      });

      it("is idempotent", () => {
        // We use an on-disk database file here so that we can dump the
        // contents to ensure that the database is physically unchanged.
        const filename = tmp.fileSync().name;
        const schema = buildGithubSchema();

        const db0 = new Database(filename);
        new Mirror(db0, schema);
        db0.close();
        const data0 = fs.readFileSync(filename).toJSON();

        const db1 = new Database(filename);
        new Mirror(db1, schema);
        db1.close();
        const data1 = fs.readFileSync(filename).toJSON();

        expect(data0).toEqual(data1);
      });

      it("rejects a different schema without changing the database", () => {
        const s = Schema;
        const schema0 = s.schema({A: s.object({id: s.id()})});
        const schema1 = s.schema({B: s.object({id: s.id()})});

        // We use an on-disk database file here so that we can dump the
        // contents to ensure that the database is physically unchanged.
        const filename = tmp.fileSync().name;
        const db = new Database(filename);
        expect(() => new Mirror(db, schema0)).not.toThrow();
        const data = fs.readFileSync(filename).toJSON();

        expect(() => new Mirror(db, schema1)).toThrow(
          "incompatible schema or version"
        );
        expect(fs.readFileSync(filename).toJSON()).toEqual(data);

        expect(() => new Mirror(db, schema1)).toThrow(
          "incompatible schema or version"
        );
        expect(fs.readFileSync(filename).toJSON()).toEqual(data);

        expect(() => new Mirror(db, schema0)).not.toThrow();
        expect(fs.readFileSync(filename).toJSON()).toEqual(data);
      });

      it("rejects a schema with SQL-unsafe type name", () => {
        const s = Schema;
        const schema0 = s.schema({
          "Non-Word-Characters": s.object({id: s.id()}),
        });
        const db = new Database(":memory:");
        expect(() => new Mirror(db, schema0)).toThrow(
          'invalid object type name: "Non-Word-Characters"'
        );
      });

      it("rejects a schema with SQL-unsafe field name", () => {
        const s = Schema;
        const schema0 = s.schema({
          A: s.object({id: s.id(), "Non-Word-Characters": s.primitive()}),
        });
        const db = new Database(":memory:");
        expect(() => new Mirror(db, schema0)).toThrow(
          'invalid field name: "Non-Word-Characters"'
        );
      });

      it("allows specifying a good schema after rejecting one", () => {
        const s = Schema;
        const schema0 = s.schema({
          A: s.object({id: s.id(), "Non-Word-Characters": s.primitive()}),
        });
        const db = new Database(":memory:");
        expect(() => new Mirror(db, schema0)).toThrow("invalid field name");
        expect(() => new Mirror(db, buildGithubSchema())).not.toThrow();
      });
    });

    describe("_createUpdate", () => {
      it("creates an update with the proper timestamp", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());

        const date = new Date(0);
        // This is equivalent to `new Date(12345)`, just more explicit
        // about the units---we should be explicit at least once in
        // update-related test code.
        date.setUTCMilliseconds(12345);

        mirror._createUpdate(date);
        expect(+date).toBe(12345); // please don't mutate the date...
        expect(
          db
            .prepare("SELECT time_epoch_millis FROM updates")
            .pluck()
            .all()
        ).toEqual([12345]);
      });
      it("returns distinct results regardless of timestamps", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        const date0 = new Date(0);
        const date1 = new Date(1);
        const uid1 = mirror._createUpdate(date0);
        const uid2 = mirror._createUpdate(date0);
        const uid3 = mirror._createUpdate(date1);
        expect(uid1).not.toEqual(uid2);
        expect(uid2).not.toEqual(uid3);
        expect(uid3).not.toEqual(uid1);
        expect(
          db
            .prepare("SELECT COUNT(1) FROM updates")
            .pluck()
            .get()
        ).toEqual(3);
      });
    });

    describe("registerObject", () => {
      it("adds an object and its connections, links, and primitives", () => {
        const db = new Database(":memory:");
        const schema = buildGithubSchema();
        const mirror = new Mirror(db, schema);
        mirror.registerObject({
          typename: "Issue",
          id: "issue:sourcecred/example-github#1",
        });

        const issueId = "issue:sourcecred/example-github#1";
        expect(
          db
            .prepare("SELECT * FROM objects WHERE typename = ? AND id = ?")
            .all("Issue", issueId)
        ).toHaveLength(1);
        expect(
          db
            .prepare(
              "SELECT fieldname FROM connections WHERE object_id = ? " +
                "ORDER BY fieldname ASC"
            )
            .pluck()
            .all(issueId)
        ).toEqual(["comments"]);
        expect(
          db
            .prepare(
              "SELECT fieldname FROM links WHERE parent_id = ? " +
                "ORDER BY fieldname ASC"
            )
            .pluck()
            .all(issueId)
        ).toEqual(["author", "parent"].sort());
        expect(
          db.prepare("SELECT * FROM primitives_Issue WHERE id = ?").all(issueId)
        ).toEqual([
          {
            id: issueId,
            url: null,
            title: null,
          },
        ]);

        expect(
          db
            .prepare(
              "SELECT COUNT(1) FROM connections WHERE last_update IS NOT NULL"
            )
            .pluck()
            .get()
        ).toBe(0);
        expect(
          db
            .prepare("SELECT COUNT(1) FROM links WHERE child_id IS NOT NULL")
            .pluck()
            .get()
        ).toBe(0);
        expect(
          db
            .prepare(
              "SELECT COUNT(1) FROM primitives_Issue WHERE " +
                "url IS NOT NULL OR title IS NOT NULL"
            )
            .pluck()
            .get()
        ).toBe(0);
      });
      it("doesn't touch an existing object with the same typename", () => {
        const db = new Database(":memory:");
        const schema = buildGithubSchema();
        const mirror = new Mirror(db, schema);
        const objectId = "issue:sourcecred/example-github#1";
        mirror.registerObject({
          typename: "Issue",
          id: objectId,
        });

        const updateId = mirror._createUpdate(new Date(123));
        db.prepare(
          "UPDATE objects SET last_update = :updateId WHERE id = :objectId"
        ).run({updateId, objectId});

        mirror.registerObject({
          typename: "Issue",
          id: objectId,
        });
        expect(
          db.prepare("SELECT * FROM objects WHERE id = ?").get(objectId)
        ).toEqual({
          typename: "Issue",
          id: objectId,
          last_update: updateId,
        });
      });
      it("rejects if an existing object's typename were to change", () => {
        const db = new Database(":memory:");
        const schema = buildGithubSchema();
        const mirror = new Mirror(db, schema);
        mirror.registerObject({typename: "Issue", id: "my-favorite-id"});
        expect(() => {
          mirror.registerObject({typename: "User", id: "my-favorite-id"});
        }).toThrow(
          'Inconsistent type for ID "my-favorite-id": ' +
            'expected "Issue", got "User"'
        );
      });
      it("rejects an unknown type", () => {
        const db = new Database(":memory:");
        const schema = buildGithubSchema();
        const mirror = new Mirror(db, schema);
        expect(() =>
          mirror.registerObject({
            typename: "Wat",
            id: "repo:sourcecred/example-github",
          })
        ).toThrow('Unknown type: "Wat"');
        expect(db.prepare("SELECT * FROM objects").all()).toHaveLength(0);
        expect(db.prepare("SELECT * FROM connections").all()).toHaveLength(0);
      });
      it("rejects a union type", () => {
        const db = new Database(":memory:");
        const schema = buildGithubSchema();
        const mirror = new Mirror(db, schema);
        expect(() =>
          mirror.registerObject({
            typename: "Actor",
            id: "user:credbot",
          })
        ).toThrow('Cannot add object of non-object type: "Actor" (UNION)');
        expect(db.prepare("SELECT * FROM objects").all()).toHaveLength(0);
        expect(db.prepare("SELECT * FROM connections").all()).toHaveLength(0);
      });
    });
  });

  describe("_buildSchemaInfo", () => {
    it("processes object types properly", () => {
      const result = _buildSchemaInfo(buildGithubSchema());
      expect(Object.keys(result.objectTypes).sort()).toEqual(
        [
          "Repository",
          "Issue",
          "IssueComment",
          "User",
          "Bot",
          "Organization",
        ].sort()
      );
      expect(result.objectTypes["Issue"].fields).toEqual(
        (buildGithubSchema().Issue: any).fields
      );
      expect(
        result.objectTypes["Issue"].primitiveFieldNames.slice().sort()
      ).toEqual(["url", "title"].sort());
      expect(result.objectTypes["Issue"].linkFieldNames.slice().sort()).toEqual(
        ["author", "parent"].sort()
      );
      expect(
        result.objectTypes["Issue"].connectionFieldNames.slice().sort()
      ).toEqual(["comments"].sort());
    });
    it("processes union types correctly", () => {
      const result = _buildSchemaInfo(buildGithubSchema());
      expect(Object.keys(result.unionTypes).sort()).toEqual(["Actor"].sort());
      expect(result.unionTypes["Actor"].clauses.slice().sort()).toEqual(
        ["User", "Bot", "Organization"].sort()
      );
    });
  });

  describe("_inTransaction", () => {
    it("runs its callback inside a transaction", () => {
      // We use an on-disk database file here because we need to open
      // two connections.
      const filename = tmp.fileSync().name;
      const db0 = new Database(filename);
      const db1 = new Database(filename);
      db0.prepare("CREATE TABLE tab (col PRIMARY KEY)").run();

      const countRows = (db) =>
        db.prepare("SELECT COUNT(1) AS n FROM tab").get().n;
      expect(countRows(db0)).toEqual(0);
      expect(countRows(db1)).toEqual(0);

      let called = false;
      _inTransaction(db0, () => {
        called = true;
        db0.prepare("INSERT INTO tab (col) VALUES (1)").run();
        expect(countRows(db0)).toEqual(1);
        expect(countRows(db1)).toEqual(0);
      });
      expect(called).toBe(true);

      expect(countRows(db0)).toEqual(1);
      expect(countRows(db1)).toEqual(1);
    });

    it("passes up the return value", () => {
      const db = new Database(":memory:");
      db.prepare("CREATE TABLE tab (col PRIMARY KEY)").run();
      expect(
        _inTransaction(db, () => {
          db.prepare("INSERT INTO tab (col) VALUES (3)").run();
          db.prepare("INSERT INTO tab (col) VALUES (4)").run();
          return db.prepare("SELECT TOTAL(col) AS n FROM tab").get().n;
        })
      ).toBe(7);
    });

    it("rolls back and rethrows on SQL error", () => {
      // In practice, this is a special case of a JavaScript error, but
      // we test it explicitly in case it goes down a different codepath
      // internally.
      const db = new Database(":memory:");
      db.prepare("CREATE TABLE tab (col PRIMARY KEY)").run();

      let threw = false;
      try {
        _inTransaction(db, () => {
          db.prepare("INSERT INTO tab (col) VALUES (1)").run();
          db.prepare("INSERT INTO tab (col) VALUES (1)").run(); // throws
          throw new Error("Should not get here.");
        });
      } catch (e) {
        threw = true;
        expect(e.name).toBe("SqliteError");
        expect(e.code).toBe("SQLITE_CONSTRAINT_PRIMARYKEY");
      }
      expect(threw).toBe(true);

      expect(db.prepare("SELECT COUNT(1) AS n FROM tab").get()).toEqual({n: 0});
    });

    it("rolls back and rethrows on JavaScript error", () => {
      const db = new Database(":memory:");
      db.prepare("CREATE TABLE tab (col PRIMARY KEY)").run();

      expect(() => {
        _inTransaction(db, () => {
          db.prepare("INSERT INTO tab (col) VALUES (1)").run();
          throw new Error("and then something goes wrong");
        });
      }).toThrow("and then something goes wrong");

      expect(db.prepare("SELECT COUNT(1) AS n FROM tab").get()).toEqual({n: 0});
    });

    it("allows the callback to commit the transaction and throw", () => {
      const db = new Database(":memory:");
      db.prepare("CREATE TABLE tab (col)").run();
      expect(() =>
        _inTransaction(db, () => {
          db.prepare("INSERT INTO tab (col) VALUES (33)").run();
          db.prepare("COMMIT").run();
          throw new Error("and then something goes wrong");
        })
      ).toThrow("and then something goes wrong");
      expect(db.prepare("SELECT TOTAL(col) AS n FROM tab").get().n).toBe(33);
    });

    it("allows the callback to roll back the transaction and return", () => {
      const db = new Database(":memory:");
      db.prepare("CREATE TABLE tab (col)").run();
      expect(
        _inTransaction(db, () => {
          db.prepare("INSERT INTO tab (col) VALUES (33)").run();
          db.prepare("ROLLBACK").run();
          return "tada";
        })
      ).toEqual("tada");
      expect(db.prepare("SELECT TOTAL(col) AS n FROM tab").get().n).toBe(0);
    });

    it("throws if the database is already in a transaction", () => {
      const db = new Database(":memory:");
      db.prepare("BEGIN").run();
      expect(() => _inTransaction(db, () => {})).toThrow(
        "already in transaction"
      );
    });
  });
});
