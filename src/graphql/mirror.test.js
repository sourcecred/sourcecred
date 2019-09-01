// @flow

import Database from "better-sqlite3";
import fs from "fs";
import tmp from "tmp";

import dedent from "../util/dedent";
import * as Schema from "./schema";
import * as Queries from "./queries";
import {
  _FIELD_PREFIXES,
  _buildSchemaInfo,
  _inTransaction,
  _makeSingleUpdateFunction,
  _nontransactionallyFindUnusedTableName,
  Mirror,
} from "./mirror";

describe("graphql/mirror", () => {
  function issueTimelineItemClauses() {
    return [
      "Commit",
      "IssueComment",
      "CrossReferencedEvent",
      "ClosedEvent",
      "ReopenedEvent",
      "SubscribedEvent",
      "UnsubscribedEvent",
      "ReferencedEvent",
      "AssignedEvent",
      "UnassignedEvent",
      "LabeledEvent",
      "UnlabeledEvent",
      "MilestonedEvent",
      "DemilestonedEvent",
      "RenamedTitleEvent",
      "LockedEvent",
      "UnlockedEvent",
    ];
  }
  function buildGithubSchema(): Schema.Schema {
    const s = Schema;
    const types: {[Schema.Typename]: Schema.NodeType} = {
      URI: s.scalar("string"),
      Date: s.scalar("string"),
      ReactionContent: s.enum([
        "THUMBS_UP",
        "THUMBS_DOWN",
        "LAUGH",
        "HOORAY",
        "CONFUSED",
        "HEART",
        "ROCKET",
        "EYES",
      ]),
      Repository: s.object({
        id: s.id(),
        url: s.primitive(),
        issues: s.connection("Issue"),
      }),
      Issue: s.object({
        id: s.id(),
        url: s.primitive(s.nonNull("URI")),
        author: s.node("Actor"),
        repository: s.node("Repository"),
        title: s.primitive(),
        comments: s.connection("IssueComment"),
        timeline: s.connection("IssueTimelineItem"),
      }),
      IssueComment: s.object({
        id: s.id(),
        body: s.primitive(),
        author: s.node("Actor"),
      }),
      Reaction: s.object({
        id: s.id(),
        content: s.primitive(s.nonNull("ReactionContent")),
        user: s.node("User"),
      }),
      Commit: s.object({
        id: s.id(),
        oid: s.primitive(),
        author: /* GitActor */ s.nested({
          date: s.primitive(s.nonNull("Date")),
          user: s.node("User"),
        }),
      }),
      IssueTimelineItem: s.union(issueTimelineItemClauses()),
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
    };
    for (const clause of issueTimelineItemClauses()) {
      if (types[clause] == null) {
        types[clause] = s.object({id: s.id(), actor: s.node("Actor")});
      }
    }
    return s.schema(types);
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
          Array.from(
            new Set([
              // Structural tables
              "meta",
              "updates",
              "objects",
              "links",
              "connections",
              "connection_entries",
              // Primitive data tables per OBJECT type (no UNIONs)
              "primitives_Reaction",
              "primitives_Repository",
              "primitives_Issue",
              "primitives_IssueComment",
              "primitives_User",
              "primitives_Bot",
              "primitives_Organization",
              ...issueTimelineItemClauses().map((x) => `primitives_${x}`),
            ])
          ).sort()
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
          "incompatible schema, options, or version"
        );
        expect(fs.readFileSync(filename).toJSON()).toEqual(data);

        expect(() => new Mirror(db, schema1)).toThrow(
          "incompatible schema, options, or version"
        );
        expect(fs.readFileSync(filename).toJSON()).toEqual(data);

        expect(() => new Mirror(db, schema0)).not.toThrow();
        expect(fs.readFileSync(filename).toJSON()).toEqual(data);
      });

      it("rejects when the set of blacklisted IDs has changed", () => {
        const db = new Database(":memory:");
        const schema = Schema.schema({A: Schema.object({id: Schema.id()})});
        new Mirror(db, schema, {blacklistedIds: []});
        expect(() => {
          new Mirror(db, schema, {blacklistedIds: ["ominous"]});
        }).toThrow("incompatible schema, options, or version");
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

      it("rejects a schema with SQL-unsafe primitive field name", () => {
        const s = Schema;
        const schema0 = s.schema({
          A: s.object({id: s.id(), "Non-Word-Characters": s.primitive()}),
        });
        const db = new Database(":memory:");
        expect(() => new Mirror(db, schema0)).toThrow(
          'invalid field name: "Non-Word-Characters"'
        );
      });

      it("rejects a schema with SQL-unsafe nested field name", () => {
        const s = Schema;
        const schema0 = s.schema({
          A: s.object({id: s.id(), "Non-Word-Characters": s.nested({})}),
        });
        const db = new Database(":memory:");
        expect(() => new Mirror(db, schema0)).toThrow(
          'invalid field name: "Non-Word-Characters"'
        );
      });

      it("rejects a schema with SQL-unsafe nested primitive field name", () => {
        const s = Schema;
        const schema0 = s.schema({
          A: s.object({
            id: s.id(),
            problem: s.nested({"Non-Word-Characters": s.primitive()}),
          }),
        });
        const db = new Database(":memory:");
        expect(() => new Mirror(db, schema0)).toThrow(
          'invalid field name: "Non-Word-Characters" under "problem"'
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

        const rowId = mirror._createUpdate(date);
        expect(rowId).toEqual(1);
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
          id: "issue:sourcecred-test/example-github#1",
        });

        const issueId = "issue:sourcecred-test/example-github#1";
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
        ).toEqual(["comments", "timeline"].sort());
        expect(
          db
            .prepare(
              "SELECT fieldname FROM links WHERE parent_id = ? " +
                "ORDER BY fieldname ASC"
            )
            .pluck()
            .all(issueId)
        ).toEqual(["author", "repository"].sort());
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
        const objectId = "issue:sourcecred-test/example-github#1";
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
            id: "repo:sourcecred-test/example-github",
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

    describe("_findOutdated", () => {
      it("finds the right objects and connections", () => {
        const db = new Database(":memory:");
        const schema = buildGithubSchema();
        const mirror = new Mirror(db, schema);
        mirror.registerObject({typename: "Repository", id: "repo:ab/cd"});
        mirror.registerObject({typename: "Issue", id: "issue:ab/cd#1"});
        mirror.registerObject({typename: "Issue", id: "issue:ab/cd#2"});
        mirror.registerObject({typename: "Issue", id: "issue:ab/cd#3"});
        mirror.registerObject({typename: "Issue", id: "issue:ab/cd#4"});

        const createUpdate = (epochTimeMillis) => ({
          time: epochTimeMillis,
          id: mirror._createUpdate(new Date(epochTimeMillis)),
        });
        const earlyUpdate = createUpdate(123);
        const midUpdate = createUpdate(456);
        const lateUpdate = createUpdate(789);

        const setObjectData = _makeSingleUpdateFunction(
          db.prepare("UPDATE objects SET last_update = :update WHERE id = :id")
        );
        setObjectData({id: "repo:ab/cd", update: earlyUpdate.id});
        setObjectData({id: "issue:ab/cd#1", update: lateUpdate.id});
        setObjectData({id: "issue:ab/cd#2", update: null});
        setObjectData({id: "issue:ab/cd#3", update: null});
        setObjectData({id: "issue:ab/cd#4", update: midUpdate.id});

        const setConnectionData = _makeSingleUpdateFunction(
          db.prepare(
            dedent`\
              UPDATE connections SET
                  last_update = :update,
                  total_count = :totalCount,
                  has_next_page = :hasNextPage,
                  end_cursor = :endCursor
              WHERE object_id = :objectId AND fieldname = :fieldname
            `
          )
        );
        setConnectionData({
          objectId: "repo:ab/cd",
          fieldname: "issues",
          update: earlyUpdate.id,
          totalCount: 1,
          hasNextPage: +false,
          endCursor: "cursor:repo.issues",
        });
        setConnectionData({
          objectId: "issue:ab/cd#1",
          fieldname: "comments",
          update: null,
          totalCount: null,
          hasNextPage: null,
          endCursor: null,
        });
        setConnectionData({
          objectId: "issue:ab/cd#2",
          fieldname: "comments",
          update: lateUpdate.id,
          totalCount: 1,
          hasNextPage: +true,
          endCursor: null,
        });
        setConnectionData({
          objectId: "issue:ab/cd#3",
          fieldname: "comments",
          update: lateUpdate.id,
          totalCount: 0,
          hasNextPage: +false,
          endCursor: null,
        });
        setConnectionData({
          objectId: "issue:ab/cd#4",
          fieldname: "comments",
          update: midUpdate.id,
          totalCount: 3,
          hasNextPage: +false,
          endCursor: "cursor:issue4.comments",
        });
        for (const n of [1, 2, 3, 4]) {
          // The "timeline" connection doesn't provide any extra useful
          // info; just mark them all updated.
          const objectId = `issue:ab/cd#${n}`;
          setConnectionData({
            objectId,
            fieldname: "timeline",
            update: lateUpdate.id,
            totalCount: 0,
            hasNextPage: +false,
            endCursor: "cursor:whatever",
          });
        }

        const actual = mirror._findOutdated(new Date(midUpdate.time));
        const expected = {
          objects: [
            {typename: "Repository", id: "repo:ab/cd"}, // loaded before cutoff
            // issue:ab/cd#1 was loaded after the cutoff
            {typename: "Issue", id: "issue:ab/cd#2"}, // never loaded
            {typename: "Issue", id: "issue:ab/cd#3"}, // never loaded
            // issue:ab/cd#4 was loaded exactly at the cutoff
          ],
          connections: [
            {
              // loaded before cutoff
              objectTypename: "Repository",
              objectId: "repo:ab/cd",
              fieldname: "issues",
              endCursor: "cursor:repo.issues",
            },
            {
              // never loaded
              objectTypename: "Issue",
              objectId: "issue:ab/cd#1",
              fieldname: "comments",
              endCursor: undefined,
            },
            {
              // loaded, but has more data available
              objectTypename: "Issue",
              objectId: "issue:ab/cd#2",
              fieldname: "comments",
              endCursor: null,
            },
            // issue:ab/cd#3.comments was loaded after the cutoff
            // issue:ab/cd#4.comments was loaded exactly at the cutoff
          ],
        };
        expect(actual).toEqual(expected);
      });
    });

    describe("_queryFromPlan", () => {
      it("errors if connections for an object have distinct typename", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        const plan = {
          objects: [],
          connections: [
            {
              objectTypename: "Issue",
              objectId: "hmmm",
              fieldname: "comments",
              endCursor: null,
            },
            {
              objectTypename: "Repository",
              objectId: "hmmm",
              fieldname: "issues",
              endCursor: null,
            },
          ],
        };
        expect(() => {
          mirror._queryFromPlan(plan, {
            nodesLimit: 10,
            nodesOfTypeLimit: 5,
            connectionLimit: 5,
            connectionPageSize: 23,
          });
        }).toThrow(
          'Query plan has inconsistent typenames for object "hmmm": ' +
            '"Issue" vs. "Repository"'
        );
      });
      it("creates a good query", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        const plan = {
          objects: [
            {typename: "Issue", id: "i#1"},
            {typename: "Repository", id: "repo#2"},
            {typename: "Issue", id: "i#3"},
            {typename: "Issue", id: "i#4"}, // will be on another page
            // cut off below this point due to the page limit
            {typename: "Issue", id: "i#5"},
          ],
          connections: [
            {
              objectTypename: "Issue",
              objectId: "i#1",
              fieldname: "comments",
              endCursor: null,
            },
            {
              objectTypename: "Issue",
              objectId: "i#4",
              fieldname: "comments",
              endCursor: null,
            },
            {
              objectTypename: "Issue",
              objectId: "i#1",
              fieldname: "timeline",
              endCursor: undefined,
            },
            {
              objectTypename: "Issue",
              objectId: "i#4",
              fieldname: "timeline",
              endCursor: "cursor#998",
            },
            {
              objectTypename: "Repository",
              objectId: "repo#5",
              fieldname: "issues",
              endCursor: "cursor#998",
            },
            // cut off below this point due to the page limit
            {
              objectTypename: "Repository",
              objectId: "repo#5",
              fieldname: "pulls",
              endCursor: "cursor#997",
            },
            {
              objectTypename: "Repository",
              objectId: "repo#6",
              fieldname: "issues",
              endCursor: "cursor#996",
            },
          ],
        };
        const actual = mirror._queryFromPlan(plan, {
          nodesLimit: 4,
          nodesOfTypeLimit: 2,
          connectionLimit: 5,
          connectionPageSize: 23,
        });
        const b = Queries.build;
        expect(actual).toEqual([
          b.alias(
            "owndata_0",
            b.field(
              "nodes",
              {ids: b.list([b.literal("i#1"), b.literal("i#3")])},
              [b.inlineFragment("Issue", mirror._queryOwnData("Issue"))]
            )
          ),
          b.alias(
            "owndata_1",
            b.field("nodes", {ids: b.list([b.literal("i#4")])}, [
              b.inlineFragment("Issue", mirror._queryOwnData("Issue")),
            ])
          ),
          b.alias(
            "owndata_2",
            b.field("nodes", {ids: b.list([b.literal("repo#2")])}, [
              b.inlineFragment(
                "Repository",
                mirror._queryOwnData("Repository")
              ),
            ])
          ),
          b.alias(
            "node_0",
            b.field("node", {id: b.literal("i#1")}, [
              b.field("id"),
              b.inlineFragment("Issue", [
                ...mirror._queryConnection("Issue", "comments", null, 23),
                ...mirror._queryConnection("Issue", "timeline", undefined, 23),
              ]),
            ])
          ),
          b.alias(
            "node_1",
            b.field("node", {id: b.literal("i#4")}, [
              b.field("id"),
              b.inlineFragment("Issue", [
                ...mirror._queryConnection("Issue", "comments", null, 23),
                ...mirror._queryConnection(
                  "Issue",
                  "timeline",
                  "cursor#998",
                  23
                ),
              ]),
            ])
          ),
          b.alias(
            "node_2",
            b.field("node", {id: b.literal("repo#5")}, [
              b.field("id"),
              b.inlineFragment("Repository", [
                ...mirror._queryConnection(
                  "Repository",
                  "issues",
                  "cursor#998",
                  23
                ),
              ]),
            ])
          ),
        ]);
      });
    });

    describe("_updateData", () => {
      it("throws if given a key with invalid prefix", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        const updateId = mirror._createUpdate(new Date(123));
        const result = {wat_0: {id: "wot"}};
        expect(() => {
          mirror._nontransactionallyUpdateData(updateId, result);
        }).toThrow('Bad key in query result: "wat_0"');
      });

      // We test the happy path lightly, because it just delegates to
      // other methods, which are themselves tested. This test is
      // sufficient to effect full coverage.
      it("processes a reasonable input correctly", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        const updateId = mirror._createUpdate(new Date(123));
        mirror.registerObject({typename: "Repository", id: "repo:foo/bar"});
        mirror.registerObject({typename: "Issue", id: "issue:#1"});
        mirror.registerObject({typename: "Issue", id: "issue:#2"});
        const result = {
          owndata_0: [
            {
              __typename: "Repository",
              id: "repo:foo/bar",
              url: "url://foo/bar",
            },
          ],
          owndata_1: [
            {
              __typename: "Issue",
              id: "issue:#1",
              url: "url://foo/bar/issue/1",
              title: "something wicked",
              repository: {
                __typename: "Repository",
                id: "repo:foo/bar",
              },
              author: {
                __typename: "User",
                id: "user:alice",
              },
            },
            {
              __typename: "Issue",
              id: "issue:#2",
              url: "url://foo/bar/issue/2",
              title: "this way comes",
              repository: {
                __typename: "Repository",
                id: "repo:foo/bar",
              },
              author: {
                __typename: "User",
                id: "user:alice",
              },
            },
          ],
          node_0: {
            id: "repo:foo/bar",
            issues: {
              totalCount: 2,
              pageInfo: {
                hasNextPage: true,
                endCursor: "cursor:repo:foo/bar.issues@0",
              },
              nodes: [{__typename: "Issue", id: "issue:#1"}],
            },
          },
          node_1: {
            id: "issue:#1",
            comments: {
              totalCount: 1,
              pageInfo: {
                hasNextPage: false,
                endCursor: "cursor:issue:#1.comments@0",
              },
              nodes: [{__typename: "IssueComment", id: "comment:#1.1"}],
            },
            timeline: {
              totalCount: 1,
              pageInfo: {
                hasNextPage: false,
                endCursor: "cursor:issue:#1.timeline@0",
              },
              nodes: [{__typename: "ClosedEvent", id: "issue:#1!closed#0"}],
            },
          },
        };
        mirror._updateData(updateId, result);

        // Check that the right objects are in the database.
        expect(
          db.prepare("SELECT * FROM objects ORDER BY id ASC").all()
        ).toEqual([
          {typename: "IssueComment", id: "comment:#1.1", last_update: null},
          {typename: "Issue", id: "issue:#1", last_update: updateId},
          {typename: "ClosedEvent", id: "issue:#1!closed#0", last_update: null},
          {typename: "Issue", id: "issue:#2", last_update: updateId},
          {typename: "Repository", id: "repo:foo/bar", last_update: updateId},
          {typename: "User", id: "user:alice", last_update: null},
        ]);

        // Check that some objects have the right primitives.
        // (These poke at the internals of the storage format a bit.)
        expect(
          db
            .prepare("SELECT * FROM primitives_Repository ORDER BY id ASC")
            .all()
        ).toEqual([{id: "repo:foo/bar", url: JSON.stringify("url://foo/bar")}]);
        expect(
          db.prepare("SELECT * FROM primitives_Issue ORDER BY id ASC").all()
        ).toEqual([
          {
            id: "issue:#1",
            url: JSON.stringify("url://foo/bar/issue/1"),
            title: JSON.stringify("something wicked"),
          },
          {
            id: "issue:#2",
            url: JSON.stringify("url://foo/bar/issue/2"),
            title: JSON.stringify("this way comes"),
          },
        ]);
        expect(
          db.prepare("SELECT * FROM primitives_User ORDER BY id ASC").all()
        ).toEqual([{id: "user:alice", login: null, url: null}]);
        expect(
          db
            .prepare("SELECT * FROM primitives_ClosedEvent ORDER BY id ASC")
            .all()
        ).toEqual([{id: "issue:#1!closed#0"}]);

        // Check that some links are correct.
        expect(
          db
            .prepare(
              "SELECT * FROM links WHERE parent_id LIKE 'issue:%' " +
                "ORDER BY parent_id, fieldname"
            )
            .all()
        ).toEqual([
          {
            parent_id: "issue:#1",
            fieldname: "author",
            child_id: "user:alice",
            rowid: expect.anything(),
          },
          {
            parent_id: "issue:#1",
            fieldname: "repository",
            child_id: "repo:foo/bar",
            rowid: expect.anything(),
          },
          {
            parent_id: "issue:#1!closed#0",
            fieldname: "actor",
            child_id: null,
            rowid: expect.anything(),
          },
          {
            parent_id: "issue:#2",
            fieldname: "author",
            child_id: "user:alice",
            rowid: expect.anything(),
          },
          {
            parent_id: "issue:#2",
            fieldname: "repository",
            child_id: "repo:foo/bar",
            rowid: expect.anything(),
          },
        ]);

        // Check that the connection metadata are correct.
        expect(
          db
            .prepare("SELECT * FROM connections ORDER BY object_id, fieldname")
            .all()
        ).toEqual([
          // Issue #1 had both comments and timeline fetched.
          {
            object_id: "issue:#1",
            fieldname: "comments",
            last_update: updateId,
            has_next_page: +false,
            end_cursor: "cursor:issue:#1.comments@0",
            total_count: 1,
            rowid: expect.anything(),
          },
          {
            object_id: "issue:#1",
            fieldname: "timeline",
            last_update: updateId,
            has_next_page: +false,
            end_cursor: "cursor:issue:#1.timeline@0",
            total_count: 1,
            rowid: expect.anything(),
          },
          // Issue #2 had no connections fetched.
          {
            object_id: "issue:#2",
            fieldname: "comments",
            last_update: null,
            has_next_page: null,
            end_cursor: null,
            total_count: null,
            rowid: expect.anything(),
          },
          {
            object_id: "issue:#2",
            fieldname: "timeline",
            last_update: null,
            has_next_page: null,
            end_cursor: null,
            total_count: null,
            rowid: expect.anything(),
          },
          // The repository had one issue fetched.
          {
            object_id: "repo:foo/bar",
            fieldname: "issues",
            last_update: updateId,
            has_next_page: +true,
            end_cursor: "cursor:repo:foo/bar.issues@0",
            total_count: 2,
            rowid: expect.anything(),
          },
        ]);

        // Check that the connection entries are correct.
        expect(
          db
            .prepare(
              dedent`\
                SELECT
                    connections.object_id AS objectId,
                    connections.fieldname AS fieldname,
                    connection_entries.idx AS idx,
                    connection_entries.child_id AS childId
                FROM connections JOIN connection_entries
                ON connection_entries.connection_id = connections.rowid
                ORDER BY objectId, fieldname, idx
              `
            )
            .all()
        ).toEqual([
          {
            objectId: "issue:#1",
            fieldname: "comments",
            idx: 1,
            childId: "comment:#1.1",
          },
          {
            objectId: "issue:#1",
            fieldname: "timeline",
            idx: 1,
            childId: "issue:#1!closed#0",
          },
          {
            objectId: "repo:foo/bar",
            fieldname: "issues",
            idx: 1,
            childId: "issue:#1",
          },
        ]);
      });
    });

    describe("update", () => {
      it("delegates and updates the database", async () => {
        const spyFindOutdated = jest.spyOn(Mirror.prototype, "_findOutdated");
        const spyQueryFromPlan = jest.spyOn(Mirror.prototype, "_queryFromPlan");
        const spyCreateUpdate = jest.spyOn(Mirror.prototype, "_createUpdate");
        const spies = [spyFindOutdated, spyQueryFromPlan, spyCreateUpdate];

        const postQuery = jest.fn();
        const now = jest
          .fn()
          .mockImplementationOnce(() => new Date(456))
          .mockImplementationOnce(() => new Date(789));

        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        mirror.registerObject({typename: "Repository", id: "repo:foo/bar"});
        postQuery.mockImplementationOnce(() =>
          Promise.resolve({
            owndata_0: [
              {
                __typename: "Repository",
                id: "repo:foo/bar",
                url: "url://foo/bar",
              },
            ],
            node_0: {
              id: "repo:foo/bar",
              issues: {
                totalCount: 1,
                pageInfo: {hasNextPage: false, endCursor: "cursor:repo@1"},
                nodes: [{__typename: "Issue", id: "issue:#1"}],
              },
            },
          })
        );
        postQuery.mockImplementationOnce(() =>
          Promise.resolve({
            owndata_0: [
              {
                __typename: "Issue",
                id: "issue:#1",
                url: "url://foo/bar/1",
                author: null,
                title: "check it out",
                repository: {__typename: "Repository", id: "repo:foo/bar"},
              },
            ],
            node_0: {
              id: "issue:#1",
              comments: {
                totalCount: 0,
                pageInfo: {hasNextPage: false, endCursor: "cursor:issue@2"},
                nodes: [],
              },
              timeline: {
                totalCount: 0,
                pageInfo: {hasNextPage: false, endCursor: "cursor:issue@3"},
                nodes: [],
              },
            },
          })
        );
        postQuery.mockImplementationOnce(() =>
          Promise.reject("Should not get here.")
        );

        await mirror.update(postQuery, {
          nodesOfTypeLimit: 2,
          nodesLimit: 3,
          connectionLimit: 4,
          connectionPageSize: 5,
          since: new Date(123),
          now: now,
        });

        // We should have invoked `_findOutdated` three times, each
        // asking for any out-of-date entries since the fixed start
        // date. The last result will be empty.
        expect(spyFindOutdated).toHaveBeenCalledTimes(3);
        expect(spyFindOutdated.mock.calls[0]).toEqual([new Date(123)]);
        expect(spyFindOutdated.mock.calls[1]).toEqual([new Date(123)]);
        expect(spyFindOutdated.mock.calls[2]).toEqual([new Date(123)]);
        expect(spyFindOutdated.mock.results[0].value).not.toEqual(
          spyFindOutdated.mock.results[1].value
        );
        expect(spyFindOutdated.mock.results[2].value).toEqual({
          objects: [],
          connections: [],
        });

        // We should have constructed two query plans, with the same
        // options each time.
        expect(spyQueryFromPlan).toHaveBeenCalledTimes(2);
        expect(spyQueryFromPlan.mock.calls[0]).toEqual([
          spyFindOutdated.mock.results[0].value,
          {
            nodesOfTypeLimit: 2,
            nodesLimit: 3,
            connectionLimit: 4,
            connectionPageSize: 5,
          },
        ]);
        expect(spyQueryFromPlan.mock.calls[1]).toEqual([
          spyFindOutdated.mock.results[1].value,
          {
            nodesOfTypeLimit: 2,
            nodesLimit: 3,
            connectionLimit: 4,
            connectionPageSize: 5,
          },
        ]);

        // We should have created two updates with sequential dates.
        expect(spyCreateUpdate).toHaveBeenCalledTimes(2);
        expect(spyCreateUpdate.mock.calls[0]).toEqual([new Date(456)]);
        expect(spyCreateUpdate.mock.calls[1]).toEqual([new Date(789)]);

        // We should now be able to extract the right data.
        const result = mirror.extract("repo:foo/bar");
        expect(result).toEqual({
          __typename: "Repository",
          id: "repo:foo/bar",
          url: "url://foo/bar",
          issues: [
            {
              __typename: "Issue",
              id: "issue:#1",
              url: "url://foo/bar/1",
              author: null,
              repository: result, // circular
              title: "check it out",
              comments: [],
              timeline: [],
            },
          ],
        });

        for (const spy of spies) {
          spy.mockRestore();
        }
      });
    });

    describe("_queryShallow", () => {
      it("fails when given a nonexistent type", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        expect(() => {
          mirror._queryShallow("Wat");
        }).toThrow('No such type: "Wat"');
      });
      it("fails when given a scalar type", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        expect(() => {
          mirror._queryShallow("Date");
        }).toThrow('Cannot create selections for scalar type: "Date"');
      });
      it("fails when given an enum type", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        expect(() => {
          mirror._queryShallow("ReactionContent");
        }).toThrow('Cannot create selections for enum type: "ReactionContent"');
      });
      it("handles an object type", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        const b = Queries.build;
        expect(mirror._queryShallow("Issue")).toEqual([
          b.field("__typename"),
          b.field("id"),
        ]);
      });
      it("handles a union type", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        const b = Queries.build;
        expect(mirror._queryShallow("Actor")).toEqual([
          b.field("__typename"),
          b.inlineFragment("User", [b.field("id")]),
          b.inlineFragment("Bot", [b.field("id")]),
          b.inlineFragment("Organization", [b.field("id")]),
        ]);
      });
    });

    describe("_getEndCursor", () => {
      it("fails when the object does not exist", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        expect(() => {
          mirror._getEndCursor("foo/bar#1", "comments");
        }).toThrow('No such connection: "foo/bar#1"."comments"');
      });
      it("fails when the object has no such connection", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        mirror.registerObject({typename: "Repository", id: "foo/bar#1"});
        expect(() => {
          mirror._getEndCursor("foo/bar#1", "comments");
        }).toThrow('No such connection: "foo/bar#1"."comments"');
      });
      it("returns `undefined` for a never-fetched connection", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        mirror.registerObject({typename: "Issue", id: "foo/bar#1"});
        expect(mirror._getEndCursor("foo/bar#1", "comments")).toBe(undefined);
      });
      it("returns a `null` cursor", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        mirror.registerObject({typename: "Issue", id: "foo/bar#1"});
        const updateId = mirror._createUpdate(new Date(123));
        db.prepare(
          dedent`\
            UPDATE connections
            SET
                last_update = :updateId,
                total_count = 0,
                has_next_page = 0,
                end_cursor = NULL
            WHERE object_id = :objectId AND fieldname = :fieldname
          `
        ).run({updateId, objectId: "foo/bar#1", fieldname: "comments"});
        expect(mirror._getEndCursor("foo/bar#1", "comments")).toBe(null);
      });
      it("returns a non-`null` cursor", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        mirror.registerObject({typename: "Issue", id: "foo/bar#1"});
        const updateId = mirror._createUpdate(new Date(123));
        db.prepare(
          dedent`\
            UPDATE connections
            SET
              last_update = :updateId,
              total_count = 1,
              end_cursor = :endCursor,
              has_next_page = 0
            WHERE object_id = :objectId AND fieldname = :fieldname
          `
        ).run({
          updateId,
          endCursor: "c29tZS1jdXJzb3I=",
          objectId: "foo/bar#1",
          fieldname: "comments",
        });
        expect(mirror._getEndCursor("foo/bar#1", "comments")).toBe(
          "c29tZS1jdXJzb3I="
        );
      });
    });

    describe("_queryConnection", () => {
      it("fails when given a nonexistent type", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        expect(() => {
          mirror._queryConnection("Wat", "wot", undefined, 23);
        }).toThrow('No such type: "Wat"');
      });
      it("fails when given a non-object type", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        expect(() => {
          mirror._queryConnection("Actor", "issues", undefined, 23);
        }).toThrow(
          'Cannot query connection on non-object type "Actor" (UNION)'
        );
      });
      it("fails when given a nonexistent field name", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        expect(() => {
          mirror._queryConnection("Issue", "mcguffins", undefined, 23);
        }).toThrow('Object type "Issue" has no field "mcguffins"');
      });
      it("fails when given a non-connection field name", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        expect(() => {
          mirror._queryConnection("Issue", "author", undefined, 23);
        }).toThrow('Cannot query non-connection field "Issue"."author" (NODE)');
      });
      it("creates a query when no cursor is specified", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        const pageLimit = 23;
        const endCursor = undefined;
        const actual = mirror._queryConnection(
          "Issue",
          "comments",
          endCursor,
          23
        );
        const b = Queries.build;
        expect(actual).toEqual([
          b.field("comments", {first: b.literal(pageLimit)}, [
            b.field("totalCount"),
            b.field("pageInfo", {}, [
              b.field("endCursor"),
              b.field("hasNextPage"),
            ]),
            b.field("nodes", {}, [b.field("__typename"), b.field("id")]),
          ]),
        ]);
      });
      it("creates a query with a `null` end cursor", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        const pageLimit = 23;
        const endCursor = null;
        const actual = mirror._queryConnection(
          "Issue",
          "comments",
          endCursor,
          23
        );
        const b = Queries.build;
        expect(actual).toEqual([
          b.field(
            "comments",
            {first: b.literal(pageLimit), after: b.literal(null)},
            [
              b.field("totalCount"),
              b.field("pageInfo", {}, [
                b.field("endCursor"),
                b.field("hasNextPage"),
              ]),
              b.field("nodes", {}, [b.field("__typename"), b.field("id")]),
            ]
          ),
        ]);
      });
      it("creates a query with a non-`null` end cursor", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        const pageLimit = 23;
        const endCursor = "c29tZS1jdXJzb3I=";
        const actual = mirror._queryConnection(
          "Issue",
          "comments",
          endCursor,
          23
        );
        const b = Queries.build;
        expect(actual).toEqual([
          b.field(
            "comments",
            {first: b.literal(pageLimit), after: b.literal(endCursor)},
            [
              b.field("totalCount"),
              b.field("pageInfo", {}, [
                b.field("endCursor"),
                b.field("hasNextPage"),
              ]),
              b.field("nodes", {}, [b.field("__typename"), b.field("id")]),
            ]
          ),
        ]);
      });
      it("snapshot test for actual GitHub queries", () => {
        // This test emits as a snapshot a valid query against GitHub's
        // GraphQL API. You should be able to copy-and-paste the
        // snapshot into <https://developer.github.com/v4/explorer/> to
        // run it.* The resulting IDs in `initialQuery` and
        // `updateQuery` should concatenate to match those in
        // `expectedIds`. In particular, the following JQ program should
        // output `true` when passed the query result from GitHub:
        //
        //     jq '
        //       .data |
        //       (([.objectInitial, .objectUpdate] | map(.issues.nodes[].id))
        //         == [.objectExpectedIds.issues.nodes[].id])
        //       and
        //       (([.unionInitial, .unionUpdate] | map(.timeline.nodes[].id))
        //         == [.unionExpectedIds.timeline.nodes[].id])
        //     '
        //
        // * This may not actually work, because the query text is
        // somewhat large (a few kilobytes), and sometimes GitHub's
        // GraphiQL explorer chokes on such endpoints. Posting directly
        // to the input with curl(1) works. You could also temporarily
        // change the `multilineLayout` to an `inlineLayout` to shave
        // off some bytes and possibly appease the GraphiQL gods.
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        const b = Queries.build;

        // Queries for a connection whose declared type is an object.
        function objectConnectionQuery(): Queries.Selection[] {
          const exampleGithubRepoId = "MDEwOlJlcG9zaXRvcnkxMjMyNTUwMDY=";
          const pageLimit = 2;
          const initialQuery = mirror._queryConnection(
            "Repository",
            "issues",
            undefined,
            pageLimit
          );
          const expectedEndCursor = "Y3Vyc29yOnYyOpHOEe_nRA==";
          const updateQuery = mirror._queryConnection(
            "Repository",
            "issues",
            expectedEndCursor,
            pageLimit
          );
          return [
            b.alias(
              "objectInitial",
              b.field("node", {id: b.literal(exampleGithubRepoId)}, [
                b.inlineFragment("Repository", initialQuery),
              ])
            ),
            b.alias(
              "objectUpdate",
              b.field("node", {id: b.literal(exampleGithubRepoId)}, [
                b.inlineFragment("Repository", updateQuery),
              ])
            ),
            b.alias(
              "objectExpectedIds",
              b.field("node", {id: b.literal(exampleGithubRepoId)}, [
                b.inlineFragment("Repository", [
                  b.field("issues", {first: b.literal(pageLimit * 2)}, [
                    b.field("nodes", {}, [b.field("id")]),
                  ]),
                ]),
              ])
            ),
          ];
        }

        // Queries for a connection whose declared type is a union.
        function unionConnectionQuery(): Queries.Selection[] {
          // Almost all GitHub connections return OBJECTs for nodes, but
          // a very few return UNIONs:
          //
          //   - `IssueTimelineConnection`,
          //   - `PullRequestTimelineConnection`, and
          //   - `SearchResultItemConnection`.
          //
          // Of these, `SearchResultItemConnection` does not adhere to
          // the same interface as the rest of the connections (it does
          // not have a `totalCount` field), so it will not work with
          // our system. But the two timeline connections are actually
          // important---they let us see who assigns labels---so we test
          // one of them.
          const exampleIssueId = "MDU6SXNzdWUzMDA5MzQ4MTg=";
          const pageLimit = 1;
          const initialQuery = mirror._queryConnection(
            "Issue",
            "timeline",
            undefined,
            pageLimit
          );
          const expectedEndCursor = "MQ==";
          const updateQuery = mirror._queryConnection(
            "Issue",
            "timeline",
            expectedEndCursor,
            pageLimit
          );
          return [
            b.alias(
              "unionInitial",
              b.field("node", {id: b.literal(exampleIssueId)}, [
                b.inlineFragment("Issue", initialQuery),
              ])
            ),
            b.alias(
              "unionUpdate",
              b.field("node", {id: b.literal(exampleIssueId)}, [
                b.inlineFragment("Issue", updateQuery),
              ])
            ),
            b.alias(
              "unionExpectedIds",
              b.field("node", {id: b.literal(exampleIssueId)}, [
                b.inlineFragment("Issue", [
                  b.field("timeline", {first: b.literal(pageLimit * 2)}, [
                    b.field("nodes", {}, [
                      ...issueTimelineItemClauses().map((clause) =>
                        b.inlineFragment(clause, [b.field("id")])
                      ),
                    ]),
                  ]),
                ]),
              ])
            ),
          ];
        }

        const query = b.query(
          "TestQuery",
          [],
          [...objectConnectionQuery(), ...unionConnectionQuery()]
        );
        const format = (body: Queries.Body): string =>
          Queries.stringify.body(body, Queries.multilineLayout("  "));
        expect(format([query])).toMatchSnapshot();
      });
    });

    describe("_updateConnection", () => {
      const createResponse = (options: {
        totalCount: number,
        endCursor: string | null,
        hasNextPage: boolean,
        comments: $ReadOnlyArray<number | null>,
      }) => ({
        totalCount: options.totalCount,
        pageInfo: {
          hasNextPage: options.hasNextPage,
          endCursor: options.endCursor,
        },
        nodes: options.comments.map((n) =>
          n === null ? null : {__typename: "IssueComment", id: `comment:${n}`}
        ),
      });
      const createEmptyResponse = () =>
        createResponse({
          totalCount: 0,
          endCursor: null,
          hasNextPage: false,
          comments: [],
        });

      it("fails when the object does not exist", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        const updateId = mirror._createUpdate(new Date(123));
        expect(() => {
          mirror._updateConnection(
            updateId,
            "foo/bar#1",
            "comments",
            createEmptyResponse()
          );
        }).toThrow('No such connection: "foo/bar#1"."comments"');
      });
      it("fails when the object has no such connection", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        const updateId = mirror._createUpdate(new Date(123));
        mirror.registerObject({typename: "Repository", id: "foo/bar#1"});
        expect(() => {
          mirror._updateConnection(
            updateId,
            "foo/bar#1",
            "comments",
            createEmptyResponse()
          );
        }).toThrow('No such connection: "foo/bar#1"."comments"');
      });
      it("fails when there is no update with the given ID", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        const updateId = 777;
        mirror.registerObject({typename: "Issue", id: "foo/bar#1"});
        expect(() => {
          mirror._updateConnection(
            updateId,
            "foo/bar#1",
            "comments",
            createEmptyResponse()
          );
        }).toThrow("FOREIGN KEY constraint failed");
      });
      it("omits connection entries corresponding to blacklisted IDs", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema(), {
          blacklistedIds: ["ominous"],
        });
        const updateId = mirror._createUpdate(new Date(123));
        mirror.registerObject({typename: "Repository", id: "repo"});
        mirror._updateConnection(updateId, "repo", "issues", {
          totalCount: 3,
          nodes: [
            {
              __typename: "Issue",
              id: "normal",
            },
            {
              __typename: "Issue",
              id: "ominous",
            },
            {
              __typename: "Issue",
              id: "pristine",
            },
          ],
          pageInfo: {
            hasNextPage: false,
            endCursor: "cursor",
          },
        });
        expect(
          db
            .prepare(
              "SELECT * FROM connection_entries ORDER BY connection_id, idx"
            )
            .all()
        ).toEqual([
          {
            rowid: expect.anything(),
            connection_id: expect.anything(),
            idx: 1,
            child_id: "normal",
          },
          {
            rowid: expect.anything(),
            connection_id: expect.anything(),
            idx: 2,
            child_id: null,
          },
          {
            rowid: expect.anything(),
            connection_id: expect.anything(),
            idx: 3,
            child_id: "pristine",
          },
        ]);
        expect(() => {
          mirror.extract("ominous");
        }).toThrow('No such object: "ominous"');
      });
      it("properly updates under various circumstances", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        mirror.registerObject({typename: "Issue", id: "foo/bar#1"});
        const connectionId: number = db
          .prepare(
            dedent`\
              SELECT rowid FROM connections
              WHERE object_id = :objectId AND fieldname = :fieldname
            `
          )
          .pluck()
          .get({objectId: "foo/bar#1", fieldname: "comments"});

        const getEntries = (): $ReadOnlyArray<{|
          +idx: number,
          +child_id: Schema.ObjectId,
        |}> =>
          db
            .prepare(
              dedent`\
                SELECT idx, child_id FROM connection_entries
                WHERE connection_id = ?
                ORDER BY idx ASC
              `
            )
            .all(connectionId);
        const getConnectionInfo = (): {|
          +last_update: number | null,
          +total_count: number | null,
          +end_cursor: string | null,
          +has_next_page: 0 | 1 | null,
        |} =>
          db
            .prepare(
              dedent`\
                SELECT last_update, total_count, end_cursor, has_next_page
                FROM connections
                WHERE rowid = ?
              `
            )
            .get(connectionId);

        expect(getConnectionInfo()).toEqual({
          last_update: null,
          total_count: null,
          end_cursor: null,
          has_next_page: null,
        });
        expect(getEntries()).toEqual([]);

        const firstUpdate = mirror._createUpdate(new Date(123));
        mirror._updateConnection(
          firstUpdate,
          "foo/bar#1",
          "comments",
          createResponse({
            totalCount: 4,
            endCursor: "uno",
            hasNextPage: true,
            comments: [101, 102],
          })
        );
        expect(getEntries()).toEqual([
          {idx: 1, child_id: "comment:101"},
          {idx: 2, child_id: "comment:102"},
        ]);
        expect(getConnectionInfo()).toEqual({
          last_update: firstUpdate,
          total_count: 4,
          end_cursor: "uno",
          has_next_page: +true,
        });

        const secondUpdate = mirror._createUpdate(new Date(234));
        mirror._updateConnection(
          secondUpdate,
          "foo/bar#1",
          "comments",
          createResponse({
            totalCount: 5,
            endCursor: "dos",
            hasNextPage: false,
            comments: [55, null, 54],
          })
        );
        expect(getEntries()).toEqual([
          {idx: 1, child_id: "comment:101"},
          {idx: 2, child_id: "comment:102"},
          {idx: 3, child_id: "comment:55"},
          {idx: 4, child_id: null},
          {idx: 5, child_id: "comment:54"},
        ]);
        expect(getConnectionInfo()).toEqual({
          last_update: secondUpdate,
          total_count: 5,
          end_cursor: "dos",
          has_next_page: +false,
        });

        const thirdUpdate = mirror._createUpdate(new Date(345));
        db.prepare(
          dedent`\
            DELETE FROM connection_entries
            WHERE connection_id = :connectionId AND idx = :idx
          `
        ).run({connectionId, idx: 3});
        mirror._updateConnection(
          thirdUpdate,
          "foo/bar#1",
          "comments",
          createResponse({
            totalCount: 6,
            endCursor: "tres",
            hasNextPage: false,
            comments: [888, 889],
          })
        );
        expect(getEntries()).toEqual([
          {idx: 1, child_id: "comment:101"},
          {idx: 2, child_id: "comment:102"},
          {idx: 4, child_id: null},
          {idx: 5, child_id: "comment:54"},
          {idx: 6, child_id: "comment:888"},
          {idx: 7, child_id: "comment:889"},
        ]);
        expect(getConnectionInfo()).toEqual({
          last_update: thirdUpdate,
          total_count: 6,
          end_cursor: "tres",
          has_next_page: +false,
        });
      });
    });

    describe("_queryOwnData", () => {
      it("fails given a nonexistent typename", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        expect(() => {
          mirror._queryOwnData("Wat");
        }).toThrow('No such type: "Wat"');
      });
      it("fails given a non-OBJECT type", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        expect(() => {
          mirror._queryOwnData("Actor");
        }).toThrow('Not an object type: "Actor" (UNION)');
      });
      it("generates a query with ID, primitives, and nodes only", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        const query = mirror._queryOwnData("Issue");
        const b = Queries.build;
        // Note: The actual selections could permissibly be permuted
        // with respect to these expected selections, causing a spurious
        // failure. If that happens, we can choose make the test more
        // robust.
        expect(query).toEqual([
          b.field("__typename"),
          b.field("id"),
          b.field("url"),
          b.field("author", {}, [
            b.field("__typename"),
            b.inlineFragment("User", [b.field("id")]),
            b.inlineFragment("Bot", [b.field("id")]),
            b.inlineFragment("Organization", [b.field("id")]),
          ]),
          b.field("repository", {}, [b.field("__typename"), b.field("id")]),
          b.field("title"),
          // no `comments`
          // no `timeline`
        ]);
      });
      it("includes nested primitives and nodes", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        const query = mirror._queryOwnData("Commit");
        const b = Queries.build;
        expect(query).toEqual([
          b.field("__typename"),
          b.field("id"),
          b.field("oid"),
          b.field("author", {}, [
            b.field("date"),
            b.field("user", {}, [b.field("__typename"), b.field("id")]),
          ]),
        ]);
      });
    });

    describe("_updateOwnData", () => {
      it("fails given a nonexistent typename", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        const updateId = mirror._createUpdate(new Date(123));
        expect(() => {
          mirror._updateOwnData(updateId, [{__typename: "Wat", id: "wot"}]);
        }).toThrow('Unknown type: "Wat"');
      });
      it("fails given a non-object typename", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        const updateId = mirror._createUpdate(new Date(123));
        expect(() => {
          mirror._updateOwnData(updateId, [{__typename: "Actor", id: "wut"}]);
        }).toThrow('Cannot update data for non-object type: "Actor" (UNION)');
      });
      it("fails given a nonexistent object with a link to itself", () => {
        // A naive implementation might register the link targets as
        // objects before verifying that the target object actually
        // exists. This test would catch such an implementation.
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        const updateId = mirror._createUpdate(new Date(123));
        expect(() => {
          mirror._updateOwnData(updateId, [
            {
              __typename: "Issue",
              id: "issue:#1",
              url: "url://issue/1",
              author: {__typename: "User", id: "alice"},
              parent: {__typename: "Issue", id: "issue:#1"},
              title: "hello",
            },
          ]);
        }).toThrow('Cannot update data for nonexistent node: "issue:#1"');
      });
      it("fails given a nonexistent object referenced in another node", () => {
        // A naive implementation might fail here similar to above.
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        mirror.registerObject({typename: "Issue", id: "issue:#1"});
        const updateId = mirror._createUpdate(new Date(123));
        expect(() => {
          mirror._updateOwnData(updateId, [
            {
              __typename: "Issue",
              id: "issue:#1",
              url: "url://issue/1",
              author: {__typename: "User", id: "alice"},
              repository: {__typename: "Issue", id: "issue:#2"},
              title: "hello",
            },
            {
              __typename: "Issue",
              id: "issue:#2",
              url: "url://issue/2",
              author: {__typename: "User", id: "alice"},
              repository: null,
              title: "wat",
            },
          ]);
        }).toThrow('Cannot update data for nonexistent node: "issue:#2"');
      });
      it("fails given a result set with inconsistent typenames", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        const updateId = mirror._createUpdate(new Date(123));
        mirror.registerObject({typename: "Repository", id: "repo:foo/bar"});
        mirror.registerObject({typename: "User", id: "user:alice"});
        expect(() => {
          mirror._updateOwnData(updateId, [
            {
              __typename: "Repository",
              id: "repo:foo/bar",
              url: "url://repo/foo/bar",
            },
            {
              __typename: "User",
              id: "user:alice",
              url: "url://user/alice",
              login: "alice",
            },
          ]);
        }).toThrow(
          'Result set has inconsistent typenames: "Repository" vs. "User"'
        );
      });
      it("fails if the input is missing any primitive fields", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        const updateId = mirror._createUpdate(new Date(123));
        mirror.registerObject({typename: "IssueComment", id: "comment:#1"});
        expect(() => {
          mirror._updateOwnData(updateId, [
            {
              __typename: "IssueComment",
              id: "comment:#1",
              author: null,
              // body omitted
            },
          ]);
        }).toThrow(
          'Missing primitive "body" on "comment:#1" of type "IssueComment" ' +
            "(got undefined)"
        );
      });
      it("fails if the input is missing any link fields", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        const updateId = mirror._createUpdate(new Date(123));
        mirror.registerObject({typename: "IssueComment", id: "comment:#1"});
        expect(() => {
          mirror._updateOwnData(updateId, [
            {
              __typename: "IssueComment",
              id: "comment:#1",
              body: "somebody",
              // author omitted
            },
          ]);
        }).toThrow(
          'Missing node reference "author" on "comment:#1" of type "IssueComment" ' +
            "(got undefined)"
        );
      });
      it("fails if the input is missing any nested fields", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        const updateId = mirror._createUpdate(new Date(123));
        mirror.registerObject({typename: "Commit", id: "commit:oid"});
        expect(() => {
          mirror._updateOwnData(updateId, [
            {
              __typename: "Commit",
              id: "commit:oid",
              oid: "yes",
              // author omitted
            },
          ]);
        }).toThrow(
          'Missing nested field "author" on "commit:oid" of type "Commit" ' +
            "(got undefined)"
        );
      });
      it("fails if the input is missing any nested primitive fields", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        const updateId = mirror._createUpdate(new Date(123));
        mirror.registerObject({typename: "Commit", id: "commit:oid"});
        expect(() => {
          mirror._updateOwnData(updateId, [
            {
              __typename: "Commit",
              id: "commit:oid",
              oid: "yes",
              author: {
                // date omitted
                user: {__typename: "User", id: "user:alice"},
              },
            },
          ]);
        }).toThrow(
          'Missing nested field "author"."date" on "commit:oid" ' +
            'of type "Commit" (got undefined)'
        );
      });
      it("fails if the input is missing any nested link fields", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        const updateId = mirror._createUpdate(new Date(123));
        mirror.registerObject({typename: "Commit", id: "commit:oid"});
        expect(() => {
          mirror._updateOwnData(updateId, [
            {
              __typename: "Commit",
              id: "commit:oid",
              oid: "yes",
              author: {
                date: "today",
                // user omitted
              },
            },
          ]);
        }).toThrow(
          'Missing nested field "author"."user" on "commit:oid" ' +
            'of type "Commit" (got undefined)'
        );
      });
      it("properly stores normal data", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        mirror.registerObject({typename: "Repository", id: "repo:foo/bar"});
        mirror.registerObject({typename: "Issue", id: "issue:#1"});
        mirror.registerObject({typename: "Issue", id: "issue:#2"});
        mirror.registerObject({typename: "Issue", id: "issue:#3"});
        mirror.registerObject({typename: "User", id: "alice"});
        const updateId = mirror._createUpdate(new Date(123));

        mirror._updateOwnData(updateId, [
          {
            __typename: "Issue",
            id: "issue:#1",
            url: "url://issue/1",
            author: {__typename: "User", id: "alice"},
            repository: {__typename: "Repository", id: "repo:foo/bar"},
            title: 13.75,
          },
          {
            __typename: "Issue",
            id: "issue:#2",
            url: null,
            author: {__typename: "User", id: "bob"}, // must be added
            repository: null,
            title: false,
          },
        ]);
        expect(
          db
            .prepare("SELECT id FROM objects WHERE typename = 'User'")
            .pluck()
            .all()
            .sort()
        ).toEqual(["alice", "bob"].sort());
        expect(
          db.prepare("SELECT * FROM primitives_Issue ORDER BY id ASC").all()
        ).toEqual([
          {id: "issue:#1", url: '"url://issue/1"', title: "13.75"},
          {id: "issue:#2", url: "null", title: "false"},
          {id: "issue:#3", url: null, title: null},
        ]);
      });
      it("stores data with non-`null` nested fields", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        const updateId = mirror._createUpdate(new Date(123));
        mirror.registerObject({typename: "Commit", id: "commit:oid"});
        mirror.registerObject({typename: "Commit", id: "commit:zzz"});
        mirror._updateOwnData(updateId, [
          {
            __typename: "Commit",
            id: "commit:oid",
            oid: "yes",
            author: {
              date: "today",
              user: {__typename: "User", id: "user:alice"},
            },
          },
          {
            __typename: "Commit",
            id: "commit:zzz",
            oid: "zzz",
            author: {
              date: null,
              user: null,
            },
          },
        ]);
        expect(
          db.prepare("SELECT * FROM primitives_Commit ORDER BY id ASC").all()
        ).toEqual([
          {
            id: "commit:oid",
            oid: '"yes"',
            author: +true,
            "author.date": '"today"',
          },
          {
            id: "commit:zzz",
            oid: '"zzz"',
            author: +true,
            "author.date": "null",
          },
        ]);
        expect(
          db.prepare("SELECT * FROM links ORDER BY parent_id ASC").all()
        ).toEqual([
          {
            rowid: expect.anything(),
            parent_id: "commit:oid",
            fieldname: "author.user",
            child_id: "user:alice",
          },
          {
            rowid: expect.anything(),
            parent_id: "commit:zzz",
            fieldname: "author.user",
            child_id: null,
          },
        ]);
        expect(
          db
            .prepare("SELECT COUNT(1) FROM objects WHERE id = 'user:alice'")
            .pluck()
            .get()
        ).toEqual(1);
      });
      it("stores data with `null` nested fields", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        const update1 = mirror._createUpdate(new Date(123));
        const update2 = mirror._createUpdate(new Date(456));
        mirror.registerObject({typename: "Commit", id: "commit:oid"});
        mirror._updateOwnData(update1, [
          {
            __typename: "Commit",
            id: "commit:oid",
            oid: "yes",
            author: {
              date: "today",
              user: {__typename: "User", id: "user:alice"},
            },
          },
        ]);
        mirror._updateOwnData(update2, [
          {
            __typename: "Commit",
            id: "commit:oid",
            oid: "mmm",
            author: null,
          },
        ]);
        expect(
          db.prepare("SELECT * FROM primitives_Commit ORDER BY id ASC").all()
        ).toEqual([
          {
            id: "commit:oid",
            oid: '"mmm"',
            author: +false,
            "author.date": "null",
          },
        ]);
        expect(
          db.prepare("SELECT * FROM links ORDER BY parent_id ASC").all()
        ).toEqual([
          {
            rowid: expect.anything(),
            parent_id: "commit:oid",
            fieldname: "author.user",
            child_id: null,
          },
        ]);
        expect(
          db
            .prepare("SELECT COUNT(1) FROM objects WHERE id = 'user:alice'")
            .pluck()
            .get()
        ).toEqual(1);
      });
      it("properly handles input of a type with no primitives", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        mirror.registerObject({typename: "Repository", id: "repo:foo/bar"});
        mirror.registerObject({typename: "LockedEvent", id: "uno"});
        mirror.registerObject({typename: "LockedEvent", id: "dos"});
        const updateId = mirror._createUpdate(new Date(123));

        mirror._updateOwnData(updateId, [
          {
            __typename: "LockedEvent",
            id: "uno",
            actor: null,
          },
          {
            __typename: "LockedEvent",
            id: "dos",
            actor: {__typename: "User", id: "user:alice"},
          },
        ]);
        expect(
          db
            .prepare("SELECT * FROM primitives_LockedEvent ORDER BY id ASC")
            .all()
        ).toEqual([{id: "dos"}, {id: "uno"}]);
        expect(
          db
            .prepare("SELECT * FROM links ORDER BY parent_id ASC")
            .all()
            .filter((x) => x.parent_id === "uno" || x.parent_id === "dos")
        ).toEqual([
          {
            parent_id: "dos",
            fieldname: "actor",
            child_id: "user:alice",
            rowid: expect.anything(),
          },
          {
            parent_id: "uno",
            fieldname: "actor",
            child_id: null,
            rowid: expect.anything(),
          },
        ]);
      });
      it("does nothing on an empty input", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        const getState = () => ({
          updates: db.prepare("SELECT * FROM updates ORDER BY rowid").all(),
          objects: db.prepare("SELECT * FROM objects ORDER BY id").all(),
          links: db
            .prepare("SELECT * FROM links ORDER BY parent_id, fieldname")
            .all(),
          connections: db
            .prepare("SELECT * FROM connections ORDER BY object_id, fieldname")
            .all(),
          connectionEntries: db
            .prepare(
              "SELECT * FROM connection_entries ORDER BY connection_id, idx"
            )
            .all(),
        });
        mirror.registerObject({typename: "Repository", id: "repo:foo/bar"});
        mirror.registerObject({typename: "Issue", id: "issue:#1"});
        const updateId = mirror._createUpdate(new Date(123));
        const pre = getState();
        mirror._updateOwnData(updateId, []);
        const post = getState();
        expect(post).toEqual(pre);
      });
      it("omits node references corresponding to blacklisted IDs", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema(), {
          blacklistedIds: ["ominous"],
        });
        const updateId = mirror._createUpdate(new Date(123));
        mirror.registerObject({typename: "IssueComment", id: "comment"});
        mirror.registerObject({typename: "Commit", id: "commit"});
        mirror._updateOwnData(updateId, [
          {
            __typename: "IssueComment",
            id: "comment",
            body: "hmm",
            author: {__typename: "User", id: "ominous"},
          },
        ]);
        mirror._updateOwnData(updateId, [
          {
            __typename: "Commit",
            id: "commit",
            oid: "deadbeef",
            author: {
              date: "today",
              user: {__typename: "User", id: "ominous"},
            },
          },
        ]);
        expect(mirror.extract("comment")).toEqual({
          __typename: "IssueComment",
          id: "comment",
          body: "hmm",
          author: null,
        });
        expect(mirror.extract("commit")).toEqual({
          __typename: "Commit",
          id: "commit",
          oid: "deadbeef",
          author: {
            date: "today",
            user: null,
          },
        });
        expect(() => {
          mirror.extract("ominous");
        }).toThrow('No such object: "ominous"');
      });
      it("snapshot test for actual GitHub queries", () => {
        // This test emits as a snapshot a valid query against GitHub's
        // GraphQL API. You can copy-and-paste the snapshot into
        // <https://developer.github.com/v4/explorer/> to run it. The
        // resulting should contain valid data about a GitHub issue.
        // Note that the "Issue" type contains all types of fields: ID,
        // primitive, node reference to object, and node reference to
        // union.
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());
        const exampleIssueId = "MDU6SXNzdWUzNDg1NDA0NjE=";
        const exampleCommitId =
          "MDY6Q29tbWl0MTIwMTQ1NTcwOjU1OTUwZjUzNTQ1NTEwOWJhNDhhYmYyYjk3N2U2NmFhMWNjMzVlNjk=";
        const b = Queries.build;
        const query = b.query(
          "TestUpdate",
          [],
          [
            b.alias(
              "issue",
              b.field("node", {id: b.literal(exampleIssueId)}, [
                b.inlineFragment("Issue", mirror._queryOwnData("Issue")),
              ])
            ),
            b.alias(
              "commit",
              b.field("node", {id: b.literal(exampleCommitId)}, [
                b.inlineFragment("Commit", mirror._queryOwnData("Commit")),
              ])
            ),
          ]
        );
        const format = (body: Queries.Body): string =>
          Queries.stringify.body(body, Queries.multilineLayout("  "));
        expect(format([query])).toMatchSnapshot();
      });
    });

    describe("extract", () => {
      // A schema with some useful edge cases.
      function buildTestSchema(): Schema.Schema {
        const s = Schema;
        return s.schema({
          Caveman: s.object({
            id: s.id(),
            only: s.primitive(),
            primitives: s.primitive(),
          }),
          Feline: s.object({
            id: s.id(),
            only: s.node("Feline"),
            lynx: s.node("Feline"),
          }),
          Socket: s.object({
            id: s.id(),
            only: s.connection("Socket"),
            connections: s.connection("Socket"),
          }),
          Nest: s.object({
            id: s.id(),
            nest: s.nested({
              egg: s.primitive(),
              cat: s.node("Feline"),
              absent: s.node("Empty"),
            }),
          }),
          Empty: s.object({
            id: s.id(),
          }),
        });
      }
      type Caveman = {|
        +__typename: "Caveman",
        +id: string,
        +only: mixed,
        +primitives: mixed,
      |};
      type Feline = {|
        +__typename: "Feline",
        +id: string,
        +only: null | Feline,
        +lynx: null | Feline,
      |};
      type Socket = {|
        +__typename: "Socket",
        +id: string,
        +only: $ReadOnlyArray<null | Socket>,
        +connections: $ReadOnlyArray<null | Socket>,
      |};
      type Nest = {|
        +__typename: "Nest",
        +id: string,
        +nest: {|
          +egg: mixed,
          +cat: null | Feline,
          +empty: null | Empty,
        |},
      |};
      type Empty = {|
        +__typename: "Empty",
        +id: string,
      |};

      it("fails if the provided object does not exist", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildTestSchema());
        expect(() => {
          mirror.extract("wat");
        }).toThrow('No such object: "wat"');
      });

      it("fails if the provided object is missing own-data", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildTestSchema());
        mirror.registerObject({typename: "Caveman", id: "brog"});
        expect(() => {
          mirror.extract("brog");
        }).toThrow(
          '"brog" transitively depends on "brog", ' +
            "but that object's own data has never been fetched"
        );
      });

      it("fails if the provided object is missing connection data", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildTestSchema());
        mirror.registerObject({typename: "Socket", id: "localhost"});
        mirror.registerObject({typename: "Socket", id: "loopback"});
        const updateId = mirror._createUpdate(new Date(123));
        mirror._updateOwnData(updateId, [
          {__typename: "Socket", id: "localhost"},
          {__typename: "Socket", id: "loopback"},
        ]);

        mirror._updateConnection(updateId, "localhost", "connections", {
          totalCount: 0,
          pageInfo: {hasNextPage: false, endCursor: null},
          nodes: [],
        });
        expect(() => {
          mirror.extract("localhost");
        }).toThrow(
          '"localhost" transitively depends on "localhost", ' +
            'but that object\'s "only" connection has never been fetched'
        );

        mirror._updateConnection(updateId, "loopback", "only", {
          totalCount: 0,
          pageInfo: {hasNextPage: false, endCursor: null},
          nodes: [],
        });
        expect(() => {
          mirror.extract("loopback");
        }).toThrow(
          '"loopback" transitively depends on "loopback", ' +
            'but that object\'s "connections" connection has never been fetched'
        );
      });

      it("fails if a transitive dependency is missing own-data", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildTestSchema());
        mirror.registerObject({typename: "Feline", id: "alpha"});
        mirror.registerObject({typename: "Feline", id: "beta"});
        mirror.registerObject({typename: "Feline", id: "gamma"});
        const updateId = mirror._createUpdate(new Date(123));
        mirror._updateOwnData(updateId, [
          {
            __typename: "Feline",
            id: "alpha",
            only: null,
            lynx: {__typename: "Feline", id: "beta"},
          },
          {
            __typename: "Feline",
            id: "beta",
            only: null,
            lynx: {__typename: "Feline", id: "gamma"},
          },
        ]);
        expect(() => {
          mirror.extract("alpha");
        }).toThrow(
          '"alpha" transitively depends on "gamma", ' +
            "but that object's own data has never been fetched"
        );
      });

      it("fails if a transitive dependency is missing connection data", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildTestSchema());
        mirror.registerObject({typename: "Socket", id: "localhost:8080"});
        mirror.registerObject({typename: "Socket", id: "localhost:7070"});
        mirror.registerObject({typename: "Socket", id: "localhost:6060"});
        const updateId = mirror._createUpdate(new Date(123));
        mirror._updateOwnData(updateId, [
          {__typename: "Socket", id: "localhost:8080"},
          {__typename: "Socket", id: "localhost:7070"},
          {__typename: "Socket", id: "localhost:6060"},
        ]);
        const updateConnection = (
          objectId: Schema.ObjectId,
          fieldname: Schema.Fieldname,
          ids: $ReadOnlyArray<Schema.ObjectId>
        ) => {
          mirror._updateConnection(updateId, objectId, fieldname, {
            totalCount: ids.length,
            pageInfo: {hasNextPage: false, endCursor: String(ids.length)},
            nodes: ids.map((id) => ({__typename: "Socket", id})),
          });
        };
        updateConnection("localhost:8080", "only", []);
        updateConnection("localhost:7070", "only", []);
        updateConnection("localhost:6060", "only", []);
        updateConnection("localhost:8080", "connections", ["localhost:7070"]);
        updateConnection("localhost:7070", "connections", ["localhost:6060"]);
        expect(() => {
          mirror.extract("localhost:8080");
        }).toThrow(
          '"localhost:8080" transitively depends on "localhost:6060", ' +
            'but that object\'s "connections" connection has never been fetched'
        );
      });

      it("handles objects that only have primitive fields", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildTestSchema());
        mirror.registerObject({typename: "Caveman", id: "brog"});
        const updateId = mirror._createUpdate(new Date(123));
        mirror._updateOwnData(updateId, [
          {__typename: "Caveman", id: "brog", only: "ugg", primitives: "ook"},
        ]);
        const result: Caveman = (mirror.extract("brog"): any);
        expect(result).toEqual({
          __typename: "Caveman",
          id: "brog",
          only: "ugg",
          primitives: "ook",
        });
      });

      it("handles objects that only have link fields", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildTestSchema());
        mirror.registerObject({typename: "Feline", id: "alpha"});
        mirror.registerObject({typename: "Feline", id: "beta"});
        mirror.registerObject({typename: "Feline", id: "gamma"});
        const updateId = mirror._createUpdate(new Date(123));
        mirror._updateOwnData(updateId, [
          {
            __typename: "Feline",
            id: "alpha",
            only: null,
            lynx: {__typename: "Feline", id: "beta"},
          },
          {
            __typename: "Feline",
            id: "beta",
            only: null,
            lynx: {__typename: "Feline", id: "gamma"},
          },
          {
            __typename: "Feline",
            id: "gamma",
            only: null,
            lynx: null,
          },
        ]);
        const result = mirror.extract("alpha");
        expect(result).toEqual({
          __typename: "Feline",
          id: "alpha",
          only: null,
          lynx: {
            __typename: "Feline",
            id: "beta",
            only: null,
            lynx: {
              __typename: "Feline",
              id: "gamma",
              only: null,
              lynx: null,
            },
          },
        });
      });

      it("handles objects that only have connection fields", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildTestSchema());
        mirror.registerObject({typename: "Socket", id: "localhost:8080"});
        mirror.registerObject({typename: "Socket", id: "localhost:7070"});
        mirror.registerObject({typename: "Socket", id: "localhost:6060"});
        const updateId = mirror._createUpdate(new Date(123));
        mirror._updateOwnData(updateId, [
          {__typename: "Socket", id: "localhost:8080"},
          {__typename: "Socket", id: "localhost:7070"},
          {__typename: "Socket", id: "localhost:6060"},
        ]);
        const updateConnection = (
          objectId: Schema.ObjectId,
          fieldname: Schema.Fieldname,
          ids: $ReadOnlyArray<Schema.ObjectId>
        ) => {
          mirror._updateConnection(updateId, objectId, fieldname, {
            totalCount: ids.length,
            pageInfo: {hasNextPage: false, endCursor: String(ids.length)},
            nodes: ids.map((id) => ({__typename: "Socket", id})),
          });
        };
        updateConnection("localhost:8080", "only", []);
        updateConnection("localhost:7070", "only", []);
        updateConnection("localhost:6060", "only", []);
        updateConnection("localhost:8080", "connections", ["localhost:7070"]);
        updateConnection("localhost:7070", "connections", [
          "localhost:6060",
          "localhost:6060",
        ]);
        updateConnection("localhost:6060", "connections", []);
        const result = mirror.extract("localhost:8080");
        expect(result).toEqual({
          __typename: "Socket",
          id: "localhost:8080",
          only: [],
          connections: [
            {
              __typename: "Socket",
              id: "localhost:7070",
              only: [],
              connections: [
                {
                  __typename: "Socket",
                  id: "localhost:6060",
                  only: [],
                  connections: [],
                },
                {
                  __typename: "Socket",
                  id: "localhost:6060",
                  only: [],
                  connections: [],
                },
              ],
            },
          ],
        });
      });

      it("handles objects with no fields", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildTestSchema());
        mirror.registerObject({typename: "Empty", id: "mt"});
        const updateId = mirror._createUpdate(new Date(123));
        mirror._updateOwnData(updateId, [{__typename: "Empty", id: "mt"}]);
        const result = mirror.extract("mt");
        expect(result).toEqual({__typename: "Empty", id: "mt"});
      });

      it("handles boolean primitives", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildTestSchema());
        mirror.registerObject({typename: "Caveman", id: "brog"});
        const updateId = mirror._createUpdate(new Date(123));
        mirror._updateOwnData(updateId, [
          {__typename: "Caveman", id: "brog", only: false, primitives: true},
        ]);
        expect(mirror.extract("brog")).toEqual({
          __typename: "Caveman",
          id: "brog",
          only: false,
          primitives: true,
        });
      });

      it("handles null primitives", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildTestSchema());
        mirror.registerObject({typename: "Caveman", id: "brog"});
        const updateId = mirror._createUpdate(new Date(123));
        mirror._updateOwnData(updateId, [
          {__typename: "Caveman", id: "brog", only: null, primitives: null},
        ]);
        expect(mirror.extract("brog")).toEqual({
          __typename: "Caveman",
          id: "brog",
          only: null,
          primitives: null,
        });
      });

      it("handles numeric primitives", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildTestSchema());
        mirror.registerObject({typename: "Caveman", id: "brog"});
        const updateId = mirror._createUpdate(new Date(123));
        mirror._updateOwnData(updateId, [
          {__typename: "Caveman", id: "brog", only: 123, primitives: 987},
        ]);
        expect(mirror.extract("brog")).toEqual({
          __typename: "Caveman",
          id: "brog",
          only: 123,
          primitives: 987,
        });
      });

      it("handles nested objects", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildTestSchema());
        mirror.registerObject({typename: "Nest", id: "eyrie"});
        mirror.registerObject({typename: "Feline", id: "meow"});
        const updateId = mirror._createUpdate(new Date(123));
        mirror._updateOwnData(updateId, [
          {
            __typename: "Nest",
            id: "eyrie",
            nest: {
              egg: "nog",
              cat: {__typename: "Feline", id: "meow"},
              absent: null,
            },
          },
        ]);
        mirror._updateOwnData(updateId, [
          {
            __typename: "Feline",
            id: "meow",
            only: {__typename: "Feline", id: "meow"},
            lynx: null,
          },
        ]);
        const result: Nest = (mirror.extract("eyrie"): any);
        expect(result).toEqual({
          __typename: "Nest",
          id: "eyrie",
          nest: {
            egg: "nog",
            cat: {
              __typename: "Feline",
              id: "meow",
              only: result.nest.cat,
              lynx: null,
            },
            absent: null,
          },
        });
      });

      it("handles cyclic link structures", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildTestSchema());
        mirror.registerObject({typename: "Feline", id: "alpha"});
        mirror.registerObject({typename: "Feline", id: "beta"});
        mirror.registerObject({typename: "Feline", id: "gamma"});
        const updateId = mirror._createUpdate(new Date(123));
        mirror._updateOwnData(updateId, [
          {
            __typename: "Feline",
            id: "alpha",
            only: null,
            lynx: {__typename: "Feline", id: "beta"},
          },
          {
            __typename: "Feline",
            id: "beta",
            only: {__typename: "Feline", id: "beta"},
            lynx: {__typename: "Feline", id: "gamma"},
          },
          {
            __typename: "Feline",
            id: "gamma",
            only: {__typename: "Feline", id: "beta"},
            lynx: null,
          },
        ]);
        const result: Feline = (mirror.extract("alpha"): any);
        expect(result).toEqual({
          __typename: "Feline",
          id: "alpha",
          only: null,
          lynx: {
            __typename: "Feline",
            id: "beta",
            only: result.lynx,
            lynx: {
              __typename: "Feline",
              id: "gamma",
              only: result.lynx,
              lynx: null,
            },
          },
        });
        expect((result: any).lynx.only).toBe(result.lynx);
        expect((result: any).lynx.lynx.only).toBe(result.lynx);
      });

      it("handles cyclic connection structures", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildTestSchema());
        mirror.registerObject({typename: "Socket", id: "localhost:8080"});
        mirror.registerObject({typename: "Socket", id: "localhost:7070"});
        mirror.registerObject({typename: "Socket", id: "localhost:6060"});
        const updateId = mirror._createUpdate(new Date(123));
        mirror._updateOwnData(updateId, [
          {__typename: "Socket", id: "localhost:8080"},
          {__typename: "Socket", id: "localhost:7070"},
          {__typename: "Socket", id: "localhost:6060"},
        ]);
        const updateConnection = (
          objectId: Schema.ObjectId,
          fieldname: Schema.Fieldname,
          ids: $ReadOnlyArray<Schema.ObjectId>
        ) => {
          mirror._updateConnection(updateId, objectId, fieldname, {
            totalCount: ids.length,
            pageInfo: {hasNextPage: false, endCursor: String(ids.length)},
            nodes: ids.map((id) => ({__typename: "Socket", id})),
          });
        };
        updateConnection("localhost:8080", "only", []);
        updateConnection("localhost:7070", "only", []);
        updateConnection("localhost:6060", "only", []);
        updateConnection("localhost:8080", "connections", ["localhost:7070"]);
        updateConnection("localhost:7070", "connections", [
          "localhost:8080",
          "localhost:7070",
          "localhost:6060",
        ]);
        updateConnection("localhost:6060", "connections", ["localhost:7070"]);
        const result: Socket = (mirror.extract("localhost:8080"): any);
        expect(result).toEqual({
          __typename: "Socket",
          id: "localhost:8080",
          only: [],
          connections: [
            {
              __typename: "Socket",
              id: "localhost:7070",
              only: [],
              connections: [
                result,
                result.connections[0],
                {
                  __typename: "Socket",
                  id: "localhost:6060",
                  only: [],
                  connections: [result.connections[0]],
                },
              ],
            },
          ],
        });
        const s8080: Socket = result;
        const s7070: Socket = ((s8080.connections[0]: Socket | null): any);
        const s6060: Socket = ((s7070.connections[2]: Socket | null): any);
        expect(s7070.connections[0]).toBe(s8080);
        expect(s7070.connections[1]).toBe(s7070);
        expect(s7070.connections[2]).toBe(s6060);
        expect(s6060.connections[0]).toBe(s7070);
      });

      it("handles connections with null and repeated values", () => {
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildTestSchema());
        mirror.registerObject({typename: "Socket", id: "localhost"});
        const updateId = mirror._createUpdate(new Date(123));
        mirror._updateOwnData(updateId, [
          {__typename: "Socket", id: "localhost"},
        ]);
        mirror._updateConnection(updateId, "localhost", "only", {
          totalCount: 0,
          pageInfo: {hasNextPage: false, endCursor: null},
          nodes: [],
        });
        mirror._updateConnection(updateId, "localhost", "connections", {
          totalCount: 6,
          pageInfo: {hasNextPage: false, endCursor: "#6"},
          nodes: [
            null,
            {__typename: "Socket", id: "localhost"},
            null,
            {__typename: "Socket", id: "localhost"},
            {__typename: "Socket", id: "localhost"},
            null,
          ],
        });
        const result: Socket = (mirror.extract("localhost"): any);
        expect(result).toEqual({
          __typename: "Socket",
          id: "localhost",
          only: [],
          connections: [null, result, null, result, result, null],
        });
        expect(result.connections[1]).toBe(result);
        expect(result.connections[3]).toBe(result);
        expect(result.connections[4]).toBe(result);
      });

      it("handles a representative normal case", () => {
        // In this test case, we have:
        //
        //   - objects that are not relevant
        //   - object types with no relevant instances
        //   - object types with no instances at all
        //   - relevant objects that are not direct dependencies
        //   - relevant objects with cyclic links and connections
        //   - relevant objects with only primitive fields
        //   - relevant objects with empty connections
        //   - relevant objects with links pointing to `null`
        //   - relevant objects with links of union type
        //   - relevant objects with non-`null` nested fields
        //   - relevant objects with `null` nested fields
        //
        // (An object is "relevant" if it is a transitive dependency of
        // the root.)
        const db = new Database(":memory:");
        const mirror = new Mirror(db, buildGithubSchema());

        const objects = {
          repo: () => ({typename: "Repository", id: "repo:foo/bar"}),
          issue1: () => ({typename: "Issue", id: "issue:#1"}),
          issue2: () => ({typename: "Issue", id: "issue:#2"}),
          issue3: () => ({typename: "Issue", id: "issue:#3"}),
          alice: () => ({typename: "User", id: "user:alice"}),
          bob: () => ({typename: "User", id: "user:bob"}),
          ethereal: () => ({typename: "User", id: "user:ethereal"}),
          nobody: () => ({typename: "User", id: "user:nobody"}),
          noboty: () => ({typename: "Bot", id: "bot:noboty"}),
          comment1: () => ({typename: "IssueComment", id: "comment:#2.1"}),
          comment2: () => ({typename: "IssueComment", id: "comment:#2.2"}),
          closedEvent: () => ({
            typename: "ClosedEvent",
            id: "issue:#2!closed#0",
          }),
          commit1: () => ({typename: "Commit", id: "commit:oid"}),
          commit2: () => ({typename: "Commit", id: "commit:zzz"}),
        };
        const asNode = ({
          typename,
          id,
        }): {|+__typename: Schema.Typename, +id: Schema.ObjectId|} => ({
          __typename: typename,
          id,
        });

        const update1 = mirror._createUpdate(new Date(123));
        const update2 = mirror._createUpdate(new Date(234));
        const update3 = mirror._createUpdate(new Date(345));

        const emptyConnection = () => ({
          totalCount: 0,
          pageInfo: {
            endCursor: null,
            hasNextPage: false,
          },
          nodes: [],
        });

        // Update #1: Own data for the repository and issues #1 and #2
        // and their authors. Connection data for issue #1 as a child of
        // the repository, but not issue #2. No comments on any issue.
        mirror.registerObject(objects.repo());
        mirror.registerObject(objects.issue1());
        mirror.registerObject(objects.issue2());
        mirror.registerObject(objects.alice());
        mirror.registerObject(objects.ethereal());
        mirror._updateOwnData(update1, [
          {
            ...asNode(objects.repo()),
            url: "url://foo/bar",
          },
        ]);
        mirror._updateOwnData(update1, [
          {
            ...asNode(objects.issue1()),
            url: "url://issue/1",
            author: asNode(objects.alice()),
            repository: asNode(objects.repo()),
            title: "this project looks dead; let's make some issues",
          },
          {
            ...asNode(objects.issue2()),
            url: "url://issue/2",
            author: asNode(objects.ethereal()),
            repository: asNode(objects.repo()),
            title: "by the time you read this, I will have deleted my account",
          },
          // issue:#3 remains unloaded
        ]);
        mirror._updateOwnData(update1, [
          {
            ...asNode(objects.alice()),
            url: "url://alice",
            login: "alice",
          },
          {
            ...asNode(objects.ethereal()),
            login: "ethereal",
            url: "url://ethereal",
          },
          // "nobody" and "noboty" remain unloaded
        ]);
        mirror._updateConnection(update1, objects.repo().id, "issues", {
          totalCount: 2,
          pageInfo: {
            endCursor: "cursor:repo:foo/bar.issues@update1",
            hasNextPage: true,
          },
          nodes: [asNode(objects.issue1())],
        });
        mirror._updateConnection(
          update1,
          objects.issue1().id,
          "comments",
          emptyConnection()
        );
        mirror._updateConnection(
          update1,
          objects.issue1().id,
          "timeline",
          emptyConnection()
        );
        mirror._updateConnection(
          update1,
          objects.issue2().id,
          "comments",
          emptyConnection()
        );
        mirror._updateConnection(
          update1,
          objects.issue2().id,
          "timeline",
          emptyConnection()
        );

        // Update #2: Issue #2 author changes to `null`. Alice posts a
        // comment on issue #2 and closes it. Issue #2 is loaded as a
        // child of the repository. Alice adds a commit to issue #1, and
        // an anonymous user also adds a commit to issue #1.
        mirror.registerObject(objects.comment1());
        mirror._updateOwnData(update2, [
          {
            ...asNode(objects.issue2()),
            url: "url://issue/2",
            author: null,
            repository: asNode(objects.repo()),
            title: "by the time you read this, I will have deleted my account",
          },
          // issue:#3 remains unloaded
        ]);
        mirror._updateOwnData(update2, [
          {
            ...asNode(objects.comment1()),
            body: "cya",
            author: asNode(objects.alice()),
          },
        ]);
        mirror._updateConnection(update2, objects.repo().id, "issues", {
          totalCount: 2,
          pageInfo: {
            endCursor: "cursor:repo:foo/bar.issues@update2",
            hasNextPage: true,
          },
          nodes: [asNode(objects.issue2())],
        });
        mirror._updateConnection(update2, objects.issue2().id, "comments", {
          totalCount: 1,
          pageInfo: {
            endCursor: "cursor:issue:#2.comments@update2",
            hasNextPage: false,
          },
          nodes: [asNode(objects.comment1())],
        });
        mirror._updateConnection(update2, objects.issue1().id, "timeline", {
          totalCount: 2,
          pageInfo: {
            endCursor: "cursor:issue:#1.timeline@update2",
            hasNextPage: false,
          },
          nodes: [asNode(objects.commit1()), asNode(objects.commit2())],
        });
        mirror._updateConnection(update2, objects.issue2().id, "timeline", {
          totalCount: 1,
          pageInfo: {
            endCursor: "cursor:issue:#2.timeline@update2",
            hasNextPage: false,
          },
          nodes: [asNode(objects.closedEvent())],
        });

        // Update #3: Bob comments on issue #2. An issue #3 is created
        // but not yet added to the repository connection. The details
        // for the commits and the closed event are fetched.
        mirror.registerObject(objects.bob());
        mirror.registerObject(objects.comment2());
        mirror.registerObject(objects.issue3());
        mirror._updateOwnData(update3, [
          {
            ...asNode(objects.commit1()),
            oid: "yes",
            author: {
              date: "today",
              user: {
                __typename: "User",
                id: "user:alice",
              },
            },
          },
        ]);
        mirror._updateOwnData(update3, [
          {
            ...asNode(objects.commit2()),
            oid: "hmm",
            author: null,
          },
        ]);
        mirror._updateOwnData(update3, [
          {
            ...asNode(objects.bob()),
            url: "url://bob",
            login: "bob",
          },
        ]);
        mirror._updateOwnData(update3, [
          {
            ...asNode(objects.comment2()),
            body: "alas, I did not know them well",
            author: asNode(objects.bob()),
          },
        ]);
        mirror._updateOwnData(update3, [
          {
            ...asNode(objects.issue3()),
            url: "url://issue/3",
            author: asNode(objects.bob()),
            repository: asNode(objects.repo()),
            title: "duly responding to the call for spurious issues",
          },
        ]);
        mirror._updateOwnData(update3, [
          {
            ...asNode(objects.closedEvent()),
            actor: asNode(objects.alice()),
          },
        ]);
        mirror._updateConnection(update3, objects.issue2().id, "comments", {
          totalCount: 2,
          pageInfo: {
            endCursor: "cursor:issue:#2.comments@update3",
            hasNextPage: false,
          },
          nodes: [asNode(objects.comment2())],
        });

        // The following entities are never referenced...
        mirror.registerObject(objects.nobody());
        mirror.registerObject(objects.noboty());
        mirror.registerObject(objects.issue3());

        const result = mirror.extract("repo:foo/bar");
        expect(result).toEqual({
          __typename: "Repository",
          id: "repo:foo/bar",
          url: "url://foo/bar",
          issues: [
            {
              __typename: "Issue",
              id: "issue:#1",
              url: "url://issue/1",
              author: {
                __typename: "User",
                id: "user:alice",
                url: "url://alice",
                login: "alice",
              },
              repository: result, // circular
              title: "this project looks dead; let's make some issues",
              comments: [],
              timeline: [
                {
                  __typename: "Commit",
                  id: "commit:oid",
                  oid: "yes",
                  author: {
                    date: "today",
                    user: {
                      __typename: "User",
                      id: "user:alice",
                      url: "url://alice",
                      login: "alice",
                    },
                  },
                },
                {
                  __typename: "Commit",
                  id: "commit:zzz",
                  oid: "hmm",
                  author: null,
                },
              ],
            },
            {
              __typename: "Issue",
              id: "issue:#2",
              url: "url://issue/2",
              author: null,
              repository: result, // circular
              title:
                "by the time you read this, I will have deleted my account",
              comments: [
                {
                  __typename: "IssueComment",
                  id: "comment:#2.1",
                  body: "cya",
                  author: {
                    __typename: "User",
                    id: "user:alice",
                    url: "url://alice",
                    login: "alice",
                  },
                },
                {
                  __typename: "IssueComment",
                  id: "comment:#2.2",
                  body: "alas, I did not know them well",
                  author: {
                    __typename: "User",
                    id: "user:bob",
                    url: "url://bob",
                    login: "bob",
                  },
                },
              ],
              timeline: [
                {
                  __typename: "ClosedEvent",
                  id: "issue:#2!closed#0",
                  actor: {
                    __typename: "User",
                    id: "user:alice",
                    url: "url://alice",
                    login: "alice",
                  },
                },
              ],
            },
          ],
        });
      });
    });

    describe("end-to-end typename guessing", () => {
      beforeAll(() => {
        jest.spyOn(console, "warn").mockImplementation(() => {});
      });
      function spyWarn(): JestMockFn<[string], void> {
        return ((console.warn: any): JestMockFn<any, void>);
      }
      beforeEach(() => {
        spyWarn().mockReset();
      });
      afterAll(() => {
        spyWarn().mockRestore();
      });

      // Guess typenames from object IDs like "<Commit>#123".
      function guessTypename(
        objectId: Schema.ObjectId
      ): Schema.Typename | null {
        const match = objectId.match(/^<([A-Za-z_-]*)>#[0-9]*$/);
        return match ? match[1] : null;
      }

      function buildMirror() {
        const db = new Database(":memory:");
        const schema = buildGithubSchema();
        return new Mirror(db, schema, {guessTypename});
      }

      it("catches bad top-level links", async () => {
        const mirror = buildMirror();
        // Reaction.user can actually be an organization.
        mirror.registerObject({typename: "Reaction", id: "<Reaction>#123"});
        const postQuery = jest.fn();
        postQuery.mockImplementationOnce(() =>
          Promise.resolve({
            owndata_0: [
              {
                __typename: "Reaction",
                id: "<Reaction>#123",
                content: "THUMBS_DOWN",
                user: {__typename: "User", id: "<Organization>#456"},
              },
            ],
          })
        );
        postQuery.mockImplementationOnce(() =>
          Promise.resolve({
            owndata_0: [
              {
                __typename: "User",
                id: "<Organization>#456",
                url: "https://example.com/org/456",
                login: "org456",
              },
            ],
          })
        );
        postQuery.mockImplementationOnce(() =>
          Promise.reject("Should not get here.")
        );
        await mirror.update(postQuery, {
          nodesOfTypeLimit: 2,
          nodesLimit: 3,
          connectionLimit: 4,
          connectionPageSize: 5,
          since: new Date(0),
          now: () => new Date(0),
        });
        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledWith(
          'Warning: when setting Reaction["<Reaction>#123"].user: ' +
            'object "<Organization>#456" looks like it should have ' +
            'type "Organization", but the server claims that it has ' +
            'type "User"'
        );
      });

      it("catches bad nested links", async () => {
        const mirror = buildMirror();
        // GitActor.user can actually be a bot.
        mirror.registerObject({typename: "Commit", id: "<Commit>#123"});
        const postQuery = jest.fn();
        postQuery.mockImplementationOnce(() =>
          Promise.resolve({
            owndata_0: [
              {
                __typename: "Commit",
                id: "<Commit>#123",
                oid: "9cba0e9e212a287ce26e8d7c2d273e1025c9f9bf",
                author: {
                  date: "yesterday",
                  user: {__typename: "User", id: "<Bot>#456"},
                },
              },
            ],
          })
        );
        postQuery.mockImplementationOnce(() =>
          Promise.resolve({
            owndata_0: [
              {
                __typename: "User",
                id: "<Bot>#456",
                url: "https://example.com/bot/456",
                login: "bot456",
              },
            ],
          })
        );
        postQuery.mockImplementationOnce(() =>
          Promise.reject("Should not get here.")
        );
        await mirror.update(postQuery, {
          nodesOfTypeLimit: 2,
          nodesLimit: 3,
          connectionLimit: 4,
          connectionPageSize: 5,
          since: new Date(0),
          now: () => new Date(0),
        });
        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledWith(
          'Warning: when setting Commit["<Commit>#123"].author.user: ' +
            'object "<Bot>#456" looks like it should have type "Bot", ' +
            'but the server claims that it has type "User"'
        );
      });

      it("catches bad connection entries", async () => {
        const mirror = buildMirror();
        // Suppose that Issue.comments could actually contain Reactions.
        mirror.registerObject({typename: "Issue", id: "<Issue>#123"});
        const postQuery = jest.fn();
        postQuery.mockImplementationOnce(() =>
          Promise.resolve({
            owndata_0: [
              {
                __typename: "Issue",
                id: "<Issue>#123",
                url: "https://example.com/issue/123",
                author: null,
                repository: null,
                title: "My twelvtythird issue",
              },
            ],
            node_0: {
              id: "<Issue>#123",
              comments: {
                totalCount: 1,
                pageInfo: {hasNextPage: false, endCursor: "cursor:comments@1"},
                nodes: [{__typename: "IssueComment", id: "<User>#456"}],
              },
              timeline: {
                totalCount: 0,
                pageInfo: {hasNextPage: false, endCursor: null},
                nodes: [],
              },
            },
          })
        );
        postQuery.mockImplementationOnce(() =>
          Promise.resolve({
            owndata_0: [
              {
                __typename: "IssueComment",
                id: "<User>#456",
                body: "dubious",
                author: null,
              },
            ],
          })
        );
        postQuery.mockImplementationOnce(() =>
          Promise.reject("Should not get here.")
        );
        await mirror.update(postQuery, {
          nodesOfTypeLimit: 2,
          nodesLimit: 3,
          connectionLimit: 4,
          connectionPageSize: 5,
          since: new Date(0),
          now: () => new Date(0),
        });
        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledWith(
          'Warning: when processing "comments" connection ' +
            'of object "<Issue>#123": ' +
            'object "<User>#456" looks like it should have type "User", ' +
            'but the server claims that it has type "IssueComment"'
        );
      });

      it("catches bad manual registrations", () => {
        const mirror = buildMirror();
        mirror.registerObject({typename: "User", id: "<Organization>#123"});
        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledWith(
          'Warning: object "<Organization>#123" looks like it should have ' +
            'type "Organization", not "User"'
        );
      });

      it("ignores null guesses", () => {
        const mirror = buildMirror();
        mirror.registerObject({typename: "User", id: "~~unorthodox~~"});
        expect(console.warn).not.toHaveBeenCalled();
      });
    });
  });

  describe("_buildSchemaInfo", () => {
    it("processes object types properly", () => {
      const result = _buildSchemaInfo(buildGithubSchema());
      expect(Object.keys(result.objectTypes).sort()).toEqual(
        Array.from(
          new Set([
            "Reaction",
            "Repository",
            "Issue",
            "IssueComment",
            "User",
            "Bot",
            "Organization",
            ...issueTimelineItemClauses(),
          ])
        ).sort()
      );
      expect(result.objectTypes["Issue"].fields).toEqual(
        (buildGithubSchema().Issue: any).fields
      );
      expect(
        result.objectTypes["Issue"].primitiveFieldNames.slice().sort()
      ).toEqual(["url", "title"].sort());
      expect(result.objectTypes["Issue"].linkFieldNames.slice().sort()).toEqual(
        ["author", "repository"].sort()
      );
      expect(
        result.objectTypes["Issue"].connectionFieldNames.slice().sort()
      ).toEqual(["comments", "timeline"].sort());
      expect(result.objectTypes["Issue"].nestedFieldNames).toEqual([]);
      expect(result.objectTypes["Commit"].nestedFieldNames).toEqual(["author"]);
      expect(result.objectTypes["Commit"].nestedFields).toEqual({
        author: {
          primitives: {date: Schema.primitive(Schema.nonNull("Date"))},
          nodes: {user: Schema.node("User")},
        },
      });
    });
    it("processes union types correctly", () => {
      const result = _buildSchemaInfo(buildGithubSchema());
      expect(Object.keys(result.unionTypes).sort()).toEqual(
        ["Actor", "IssueTimelineItem"].sort()
      );
      expect(result.unionTypes["Actor"].clauses.slice().sort()).toEqual(
        ["User", "Bot", "Organization"].sort()
      );
    });
  });

  describe("_FIELD_PREFIXES", () => {
    it("has the identity prefix relation", () => {
      for (const k1 of Object.keys(_FIELD_PREFIXES)) {
        for (const k2 of Object.keys(_FIELD_PREFIXES)) {
          expect({k1, k2, isPrefix: k1.startsWith(k2)}).toEqual({
            k1,
            k2,
            isPrefix: k1 === k2,
          });
        }
      }
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

  describe("_makeSingleUpdateFunction", () => {
    function createTestDb() {
      const db = new Database(":memory:");
      db.prepare("CREATE TABLE tab (id, value)").run();
      db.prepare("INSERT INTO tab (id, value) VALUES (1, 'hello')").run();
      db.prepare("INSERT INTO tab (id, value) VALUES (2, 'world')").run();
      db.prepare("INSERT INTO tab (id, value) VALUES (2, 'dlrow')").run();
      return db;
    }
    it("refuses to process a statement that returns data", () => {
      const db = new Database(":memory:");
      const stmt = db.prepare("SELECT 1");
      expect(() => {
        _makeSingleUpdateFunction(stmt);
      }).toThrow(
        "Cannot create update function for statement that returns data: " +
          "SELECT 1"
      );
    });
    it("creates a function that executes its statement", () => {
      const db = createTestDb();
      const fn = _makeSingleUpdateFunction(
        db.prepare("UPDATE tab SET value = :value WHERE id = :id")
      );
      fn({id: 1, value: "goodbye"});
      const rows = db
        .prepare("SELECT id AS id, value AS value FROM tab ORDER BY rowid ASC")
        .all();
      expect(rows).toEqual([
        {id: 1, value: "goodbye"},
        {id: 2, value: "world"},
        {id: 2, value: "dlrow"},
      ]);
    });
    it("throws if there are no updates", () => {
      const db = createTestDb();
      const fn = _makeSingleUpdateFunction(
        db.prepare("UPDATE tab SET value = :value WHERE id = :id")
      );
      expect(() => {
        fn({id: 3, value: "wat"});
      }).toThrow(
        "Bad change count: " +
          JSON.stringify({
            source: "UPDATE tab SET value = :value WHERE id = :id",
            args: {id: 3, value: "wat"},
            changes: 0,
          })
      );
    });
    it("throws if there are multiple updates", () => {
      const db = createTestDb();
      const fn = _makeSingleUpdateFunction(
        db.prepare("UPDATE tab SET value = :value WHERE id = :id")
      );
      expect(() => {
        fn({id: 2, value: "wot"});
      }).toThrow(
        "Bad change count: " +
          JSON.stringify({
            source: "UPDATE tab SET value = :value WHERE id = :id",
            args: {id: 2, value: "wot"},
            changes: 2,
          })
      );
    });
  });

  describe("_nontransactionallyFindUnusedTableName", () => {
    it("throws if the name is not SQL-safe", () => {
      const db = new Database(":memory:");
      expect(() => {
        _nontransactionallyFindUnusedTableName(db, "w a t");
      }).toThrow('Unsafe table name prefix: "w a t"');
    });
    it("does not actually create any tables or indices", () => {
      const db = new Database(":memory:");
      db.prepare("CREATE TABLE tab (col)").run();
      db.prepare("CREATE INDEX idx ON tab (col)").run();
      const getMaster = db.prepare(
        dedent`
          SELECT
              type, name, tbl_name, rootpage, sql
          FROM sqlite_master
          ORDER BY
              type, name, tbl_name, rootpage, sql
        `
      );
      const pre = getMaster.all();
      expect(pre).toHaveLength(2); // one table, one index
      _nontransactionallyFindUnusedTableName(db, "hello");
      const post = getMaster.all();
      expect(post).toEqual(pre);
    });
    it("behaves when there are no conflicts", () => {
      const db = new Database(":memory:");
      db.prepare("CREATE TABLE three (col)").run();
      expect(_nontransactionallyFindUnusedTableName(db, "two_")).toEqual(
        "two_1"
      );
    });
    it("behaves when there are table-name conflicts", () => {
      const db = new Database(":memory:");
      db.prepare("CREATE TABLE two_1 (col)").run();
      expect(_nontransactionallyFindUnusedTableName(db, "two_")).toEqual(
        "two_2"
      );
    });
    it("behaves when there are index-name conflicts", () => {
      const db = new Database(":memory:");
      db.prepare("CREATE TABLE tab (col)").run();
      db.prepare("CREATE INDEX idx_1 ON tab (col)").run();
      expect(_nontransactionallyFindUnusedTableName(db, "idx_")).toEqual(
        "idx_2"
      );
    });
    it("behaves when there are discontinuities", () => {
      const db = new Database(":memory:");
      db.prepare("CREATE TABLE two_1 (col)").run();
      db.prepare("CREATE TABLE two_3 (col)").run();
      expect(_nontransactionallyFindUnusedTableName(db, "two_")).toEqual(
        // It would also be fine for this to return `two_2`.
        "two_4"
      );
    });
    it("behaves in the face of lexicographical discontinuities", () => {
      const db = new Database(":memory:");
      for (let i = 1; i <= 10; i++) {
        db.prepare(`CREATE TABLE two_${i} (col)`).run();
      }
      expect(_nontransactionallyFindUnusedTableName(db, "two_")).toEqual(
        "two_11"
      );
    });
    //
  });
});
