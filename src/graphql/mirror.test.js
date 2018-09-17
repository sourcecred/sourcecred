// @flow

import Database from "better-sqlite3";
import tmp from "tmp";

import {_inTransaction} from "./mirror";

describe("graphql/mirror", () => {
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
