// @flow

import {Graph, type Edge, EdgeAddress} from "../../core/graph";
import {GraphView} from "./graphView";
import * as GE from "./edges";
import * as GN from "./nodes";
import {COMMIT_TYPE, toRaw as gitToRaw} from "../git/nodes";
import {exampleGraph} from "./example/example";

function exampleView() {
  return new GraphView(exampleGraph());
}

const decentralion: GN.UserlikeAddress = {
  type: "USERLIKE",
  subtype: "USER",
  login: "decentralion",
};
const wchargin: GN.UserlikeAddress = {
  type: "USERLIKE",
  subtype: "USER",
  login: "wchargin",
};

describe("plugins/github/graphView", () => {
  const view = exampleView();
  const repos = Array.from(view.repos());
  it("has one repo", () => {
    expect(repos).toHaveLength(1);
  });
  const repo = repos[0];
  it("repo matches snapshot", () => {
    expect(repo).toMatchSnapshot();
  });

  describe("issues", () => {
    const issues = Array.from(view.issues(repo));
    it("number of issues matches snapshot", () => {
      expect(issues.length).toMatchSnapshot();
    });

    describe("/#2", () => {
      const issue = issues[1];
      it("matches snapshot", () => {
        expect(issue).toMatchSnapshot();
      });
      it("is issue #2", () => {
        expect(issue.number).toBe("2");
      });
      it("is authored by decentralion", () => {
        expect(Array.from(view.authors(issue))).toEqual([decentralion]);
      });
      it("has the right parent", () => {
        expect(view.parent(issue)).toEqual(repo);
      });
      const comments = Array.from(view.comments(issue));
      it("number of comments matches snapshot", () => {
        expect(comments.length).toMatchSnapshot();
      });

      describe("/comment #1", () => {
        const comment = comments[0];
        it("matches snapshot", () => {
          expect(comment).toMatchSnapshot();
        });
        it("has the right parent", () => {
          expect(view.parent(comment)).toEqual(issue);
        });
        it("is authored by decentralion", () => {
          expect(Array.from(view.authors(comment))).toEqual([decentralion]);
        });
      });
    });
  });

  describe("pulls", () => {
    const pulls = Array.from(view.pulls(repo));
    it("number of pulls matches snapshot", () => {
      expect(pulls.length).toMatchSnapshot();
    });

    describe("/#5", () => {
      const pull = pulls[1];
      it("matches snapshot", () => {
        expect(pull).toMatchSnapshot();
      });
      it("is pull #5", () => {
        expect(pull.number).toBe("5");
      });
      it("is authored by decentralion", () => {
        expect(Array.from(view.authors(pull))).toEqual([decentralion]);
      });
      it("has the right parent", () => {
        expect(view.parent(pull)).toEqual(repo);
      });
      const comments = Array.from(view.comments(pull));
      it("number of comments matches snapshot", () => {
        expect(comments.length).toMatchSnapshot();
      });

      describe("/comment #1", () => {
        const comment = comments[0];
        it("matches snapshot", () => {
          expect(comment).toMatchSnapshot();
        });
        it("has the right parent", () => {
          expect(view.parent(comment)).toEqual(pull);
        });
        it("is authored by wchargin", () => {
          expect(Array.from(view.authors(comment))).toEqual([wchargin]);
        });
      });
      const reviews = Array.from(view.reviews(pull));
      it("number of reviews matches snapshot", () => {
        expect(reviews.length).toMatchSnapshot();
      });

      describe("/review #1", () => {
        const review = reviews[0];
        it("matches snapshot", () => {
          expect(review).toMatchSnapshot();
        });
        it("has the right parent", () => {
          expect(view.parent(review)).toEqual(pull);
        });
        it("is authored by wchargin", () => {
          expect(Array.from(view.authors(review))).toEqual([wchargin]);
        });
        const reviewComments = Array.from(view.comments(review));
        it("has the right number of review comments", () => {
          expect(reviewComments.length).toMatchSnapshot();
        });

        describe("/comment #1", () => {
          const reviewComment = reviewComments[0];
          it("is authored by wchargin", () => {
            expect(Array.from(view.authors(reviewComment))).toEqual([wchargin]);
          });
          it("matches snapshot", () => {
            expect(reviewComment).toMatchSnapshot();
          });
          it("has the right parent", () => {
            expect(view.parent(reviewComment)).toEqual(review);
          });
        });
      });
    });
  });
  describe("invariants", () => {
    const userlike: GN.UserlikeAddress = {
      type: "USERLIKE",
      subtype: "USER",
      login: "decentralion",
    };
    const repo: GN.RepoAddress = {
      type: "REPO",
      owner: "sourcecred",
      name: "example-github",
    };
    const issue: GN.IssueAddress = {type: "ISSUE", repo, number: "11"};
    const pull: GN.PullAddress = {type: "PULL", repo, number: "12"};
    const review: GN.ReviewAddress = {type: "REVIEW", pull, id: "foo"};
    const issueComment: GN.CommentAddress = {
      type: "COMMENT",
      parent: issue,
      id: "bar",
    };
    const pullComment: GN.CommentAddress = {
      type: "COMMENT",
      parent: pull,
      id: "bar1",
    };
    const reviewComment: GN.CommentAddress = {
      type: "COMMENT",
      parent: review,
      id: "bar2",
    };
    const nameToAddress = {
      userlike: userlike,
      repo: repo,
      issue: issue,
      pull: pull,
      review: review,
      issueComment: issueComment,
      pullComment: pullComment,
      reviewComment: reviewComment,
    };
    describe("there must be parents for", () => {
      function needParentFor(name: string) {
        it(name, () => {
          const g = new Graph();
          const example = nameToAddress[name];
          g.addNode(GN.toRaw(example));
          expect(() => new GraphView(g)).toThrow("Parent invariant");
        });
      }
      needParentFor("issue");
      needParentFor("pull");
      needParentFor("review");
      needParentFor("review");
      needParentFor("issueComment");
      needParentFor("pullComment");
      needParentFor("reviewComment");
    });

    describe("edge invariants", () => {
      const exampleWithParents = () => {
        const g = new Graph()
          .addNode(GN.toRaw(repo))
          .addNode(GN.toRaw(issue))
          .addEdge(GE.createEdge.hasParent(issue, repo))
          .addNode(GN.toRaw(pull))
          .addEdge(GE.createEdge.hasParent(pull, repo))
          .addNode(GN.toRaw(review))
          .addEdge(GE.createEdge.hasParent(review, pull))
          .addNode(GN.toRaw(issueComment))
          .addEdge(GE.createEdge.hasParent(issueComment, issue))
          .addNode(GN.toRaw(pullComment))
          .addEdge(GE.createEdge.hasParent(pullComment, pull))
          .addNode(GN.toRaw(reviewComment))
          .addEdge(GE.createEdge.hasParent(reviewComment, review))
          .addNode(GN.toRaw(userlike));
        return g;
      };
      function failsForEdge(edge: Edge) {
        const g = exampleWithParents()
          .addNode(edge.src)
          .addNode(edge.dst)
          .addEdge(edge);
        expect(() => new GraphView(g)).toThrow("Invariant: Edge");
      }
      describe("authors edges", () => {
        it("src must be userlike", () => {
          // $ExpectFlowError
          const badEdge = GE.createEdge.authors(pull, issue);
          failsForEdge(badEdge);
        });
        it("dst must be authorable", () => {
          // $ExpectFlowError
          const badEdge = GE.createEdge.authors(userlike, repo);
          failsForEdge(badEdge);
        });
        it("src must be author in edge address", () => {
          const otherAuthor = {
            type: "USERLIKE",
            subtype: "USER",
            login: "wchargin",
          };
          const authorsEdge = GE.createEdge.authors(otherAuthor, issue);
          (authorsEdge: any).src = GN.toRaw(userlike);
          const g = exampleWithParents().addEdge(authorsEdge);
          expect(() => new GraphView(g)).toThrow("Invariant: Expected src");
        });
        it("dst must be content in edge address", () => {
          const authorsEdge = GE.createEdge.authors(userlike, issue);
          (authorsEdge: any).dst = GN.toRaw(pull);
          const g = exampleWithParents().addEdge(authorsEdge);
          expect(() => new GraphView(g)).toThrow("Invariant: Expected dst");
        });
      });
      describe("merged as edges", () => {
        const commit = {type: COMMIT_TYPE, hash: "hash"};
        it("src must be a pull", () => {
          // $ExpectFlowError
          const badEdge = GE.createEdge.mergedAs(issue, commit);
          failsForEdge(badEdge);
        });
        it("src must be pull in edge address", () => {
          const otherPull = {type: "PULL", repo, number: "143"};
          const mergedAs = GE.createEdge.mergedAs(otherPull, commit);
          (mergedAs: any).src = GN.toRaw(pull);
          const g = exampleWithParents()
            .addNode(gitToRaw(commit))
            .addEdge(mergedAs);
          expect(() => new GraphView(g)).toThrow("Invariant: Expected src");
        });
      });
      describe("references edges", () => {
        it("src must be a TextContentAddress", () => {
          // $ExpectFlowError
          const badEdge = GE.createEdge.references(userlike, pull);
          failsForEdge(badEdge);
        });
        it("src must be the referrer in edge address", () => {
          const references = GE.createEdge.references(issue, review);
          (references: any).src = GN.toRaw(pull);
          const g = exampleWithParents().addEdge(references);
          expect(() => new GraphView(g)).toThrow("Invariant: Expected src");
        });
        it("dst must be referent in edge address", () => {
          const references = GE.createEdge.references(issue, review);
          (references: any).dst = GN.toRaw(pull);
          const g = exampleWithParents().addEdge(references);
          expect(() => new GraphView(g)).toThrow("Invariant: Expected dst");
        });
      });
      describe("has parent edges", () => {
        it("must satisfy specific hom relationships", () => {
          const g = new Graph()
            .addNode(GN.toRaw(repo))
            // $ExpectFlowError
            .addEdge(GE.createEdge.hasParent(repo, repo));
          expect(() => new GraphView(g)).toThrow("Invariant: Edge");
        });
        it("must be unique", () => {
          const otherRepo = {type: "REPO", owner: "foo", name: "bar"};
          const g = exampleWithParents();
          g.addNode(GN.toRaw(otherRepo));
          const otherParent = {
            src: GN.toRaw(issue),
            dst: GN.toRaw(otherRepo),
            address: EdgeAddress.append(GE.Prefix.hasParent, "foobar"),
          };
          g.addEdge(otherParent);
          expect(() => new GraphView(g)).toThrow("Parent invariant");
        });
        it("must match the parent specified in the node address", () => {
          const otherRepo = {type: "REPO", owner: "foo", name: "bar"};
          const otherParent = GE.createEdge.hasParent(issue, otherRepo);
          const g = new Graph()
            .addNode(GN.toRaw(issue))
            .addNode(GN.toRaw(otherRepo))
            .addEdge(otherParent);
          expect(() => new GraphView(g)).toThrow("has the wrong parent");
        });
        it("must match child specified in the edge address", () => {
          const parent = GE.createEdge.hasParent(issue, repo);
          (parent: any).src = GN.toRaw(pull);
          const g = new Graph()
            .addNode(GN.toRaw(pull))
            .addNode(GN.toRaw(repo))
            .addEdge(parent);
          expect(() => new GraphView(g)).toThrow("Invariant: Expected src");
        });
      });
      describe("reactions edges", () => {
        it("must have a supported type", () => {
          const unsupported = ["THUMBS_DOWN", "LAUGH", "CONFUSED"];
          for (const u of unsupported) {
            failsForEdge(GE.createEdge.reacts(u, userlike, issue));
          }
        });
      });
    });

    it("are properly re-entrant", () => {
      const g = new Graph();
      const view = new GraphView(g);
      // no error, empty graph is fine
      view.graph();
      // introduce an invariant violation (no parent)
      g.addNode(GN.toRaw(issue));
      try {
        view.graph();
      } catch (_) {}
      expect(() => view.graph()).toThrow("invariant violated");
    });

    describe("are checked on every public method", () => {
      const badView = () => {
        const g = new Graph();
        const view = new GraphView(g);
        g.addNode(GN.toRaw(issue));
        g.addNode(GN.toRaw(pull));
        g.addNode(GN.toRaw(repo));
        return view;
      };
      const methods = {
        graph: () => badView().graph(),
        repos: () => Array.from(badView().repos()),
        issues: () => Array.from(badView().issues(repo)),
        pulls: () => Array.from(badView().pulls(repo)),
        comments: () => Array.from(badView().comments(issue)),
        reviews: () => Array.from(badView().reviews(pull)),
        parent: () => badView().parent(pull),
        authors: () => Array.from(badView().authors(pull)),
      };

      for (const name of Object.keys(methods)) {
        it(`including ${name}`, () => {
          const method = methods[name];
          expect(() => method()).toThrow("invariant");
        });
      }
    });
  });
});
