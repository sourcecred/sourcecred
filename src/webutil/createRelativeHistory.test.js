// @flow

import React from "react";
import {Router} from "react-router";
import {Route, Link} from "react-router-dom";
import {mount, render} from "enzyme";

import normalize from "../util/pathNormalize";
import type {History /* actually `any` */} from "./createRelativeHistory";
import {createMemoryHistory} from "history";
import createRelativeHistory from "./createRelativeHistory";
import {configureEnzyme, relativeEntries, memoryEntries} from "./testUtil";

const stringToLocation = (path: string): Object => ({pathname: path});
configureEnzyme();

describe("webutil/createRelativeHistory", () => {
  function createHistory(basename: string, path: string) {
    const memoryHistory = createMemoryHistory({initialEntries: [path]});
    const relativeHistory = createRelativeHistory(memoryHistory, basename);
    return {memoryHistory, relativeHistory};
  }

  describe("by direct interaction", () => {
    describe("construction", () => {
      it("should require a valid `history` implementation", () => {
        const historyV3String = "/bad/param/";
        expect(() => createRelativeHistory(historyV3String, "/")).toThrow(
          "delegate: expected history@4 implementation, got:/bad/param/"
        );
      });
      it("should require a basename", () => {
        expect(() =>
          createHistory(
            // $FlowExpectedError
            undefined,
            "undefined/"
          )
        ).toThrow("basename: expected string, got: undefined");
      });
      it("should reject a basename that does not start with a slash", () => {
        expect(() =>
          createHistory("not-a-slash/", "not-a-slash/thing")
        ).toThrow("basename: must be absolute: not-a-slash/");
      });
      it("should reject a basename that does not end with a slash", () => {
        expect(() => createHistory("/not-a-dir", "/not-a-dir/thing")).toThrow(
          "basename: must end in slash: /not-a-dir"
        );
      });
      it("should reject a basename that is not a prefix of the location", () => {
        expect(() => createHistory("/foo/bar/", "/not/foo/bar/")).toThrow(
          'basename violation: "/foo/bar/" is not a prefix of "/not/foo/bar/"'
        );
      });
    });

    // We perform some minimal testing with a root basename. Most of the
    // interesting cases can only be usefully covered with a non-root
    // basename, and are unlikely to break only for a root basename, so
    // there's no need to duplicate the tests.
    describe('with a root basename ("/")', () => {
      it("should return React-space from `location`", () => {
        const {memoryHistory, relativeHistory} = createHistory(
          "/",
          "/foo/bar/"
        );
        expect(relativeHistory.location.pathname).toEqual("/foo/bar/");
        memoryHistory.push("/baz/quux/");
        expect(relativeHistory.location.pathname).toEqual("/baz/quux/");
      });
      it("should return DOM-space from `createHref` at root", () => {
        expect(
          createHistory("/", "/").relativeHistory.createHref(
            stringToLocation("/favicon.png")
          )
        ).toEqual("favicon.png");
      });
      it("should return DOM-space from `createHref` at non-root", () => {
        expect(
          createHistory("/", "/foo/bar/").relativeHistory.createHref(
            stringToLocation("/favicon.png")
          )
        ).toEqual("../../favicon.png");
      });
      it("should accept a location string for `push`", () => {
        const {memoryHistory, relativeHistory} = createHistory(
          "/",
          "/foo/bar/"
        );
        relativeHistory.push("/baz/quux/#browns");
        expect(memoryHistory.location).toEqual(
          expect.objectContaining({
            pathname: "/baz/quux/",
            search: "",
            hash: "#browns",
            state: undefined,
          })
        );
      });
      it("should accept a location object for `push`", () => {
        const {memoryHistory, relativeHistory} = createHistory(
          "/",
          "/foo/bar/"
        );
        relativeHistory.push({
          pathname: "/baz/quux/",
          hash: "#browns",
          state: {bat: "ter"},
        });
        expect(memoryHistory.location).toEqual(
          expect.objectContaining({
            pathname: "/baz/quux/",
            search: "",
            hash: "#browns",
            state: {bat: "ter"},
          })
        );
      });
    });

    describe('with a non-root basename ("/my/gateway/")', () => {
      const createStandardHistory = () =>
        createHistory("/my/gateway/", "/my/gateway/foo/bar/");

      describe("location property", () => {
        it("should return the initial location, in React-space", () => {
          const {relativeHistory} = createStandardHistory();
          expect(relativeHistory.location.pathname).toEqual("/foo/bar/");
        });
        it("should accommodate changes in the delegate location", () => {
          const {memoryHistory, relativeHistory} = createStandardHistory();
          memoryHistory.push("/my/gateway/baz/quux/");
          expect(relativeHistory.location.pathname).toEqual("/baz/quux/");
        });
        it("should throw if the delegate moves out of basename scope", () => {
          const {memoryHistory, relativeHistory} = createStandardHistory();
          expect(relativeHistory.location.pathname).toEqual("/foo/bar/");
          memoryHistory.push("/not/my/gateway/baz/quux/");
          expect(() => relativeHistory.location).toThrow(
            'basename violation: "/my/gateway/" is not ' +
              'a prefix of "/not/my/gateway/baz/quux/"'
          );
        });
      });

      describe("listen", () => {
        function testListener(target: "RELATIVE" | "MEMORY") {
          const {memoryHistory, relativeHistory} = createStandardHistory();
          const listener = jest.fn();
          relativeHistory.listen(listener);
          expect(listener).toHaveBeenCalledTimes(0);
          listener.mockImplementationOnce((newLocation) => {
            // We should already have transitioned.
            expect(relativeHistory.location.pathname).toEqual(
              newLocation.pathname
            );
            expect(newLocation.pathname).toEqual("/baz/quux/");
            expect(newLocation.hash).toEqual("#browns");
            expect(newLocation.search).toEqual("");
          });
          if (target === "RELATIVE") {
            relativeHistory.push("/baz/quux/#browns");
          } else if (target === "MEMORY") {
            memoryHistory.push("/my/gateway/baz/quux/#browns");
          } else {
            throw new Error((target: empty));
          }
          expect(listener).toHaveBeenCalledTimes(1);
        }

        it("should handle events fired on the relative history", () => {
          testListener("RELATIVE");
        });

        it("should handle events fired on the delegate history", () => {
          testListener("MEMORY");
        });

        it("should unlisten when asked", () => {
          const {memoryHistory, relativeHistory} = createStandardHistory();
          const listener = jest.fn();
          const unlisten = relativeHistory.listen(listener);

          expect(listener).toHaveBeenCalledTimes(0);
          memoryHistory.push("/my/gateway/baz/quux/#browns");
          expect(listener).toHaveBeenCalledTimes(1);

          unlisten();
          memoryHistory.push("/my/gateway/some/thing/else/");
          expect(listener).toHaveBeenCalledTimes(1);
        });
      });

      // For some reason, the `memoryHistory` delegate seems to treat
      // `push`, and `replace` identically: in particular, the action
      // assigned tot he resulting location is, in all cases, "POP".
      // I don't know what the difference is supposed to be.
      function testTransitionFunction(method: "push" | "replace") {
        it("should accept a location string", () => {
          const {memoryHistory, relativeHistory} = createStandardHistory();
          relativeHistory[method].call(relativeHistory, "/baz/quux/#browns");
          expect(memoryHistory.location).toEqual(
            expect.objectContaining({
              pathname: "/my/gateway/baz/quux/",
              search: "",
              hash: "#browns",
            })
          );
          expect(relativeHistory.location).toEqual(
            expect.objectContaining({
              pathname: "/baz/quux/",
              search: "",
              hash: "#browns",
            })
          );
        });
        it("should accept a location object", () => {
          const {memoryHistory, relativeHistory} = createStandardHistory();
          relativeHistory[method].call(relativeHistory, {
            pathname: "/baz/quux/",
            hash: "#browns",
            state: "california",
          });
          expect(memoryHistory.location).toEqual(
            expect.objectContaining({
              pathname: "/my/gateway/baz/quux/",
              search: "",
              hash: "#browns",
              state: "california",
            })
          );
          expect(relativeHistory.location).toEqual(
            expect.objectContaining({
              pathname: "/baz/quux/",
              search: "",
              hash: "#browns",
              state: "california",
            })
          );
        });
      }
      describe("push", () => {
        testTransitionFunction("push");
      });
      describe("replace", () => {
        testTransitionFunction("replace");
      });

      const createFivePageHistory = () => {
        const {memoryHistory, relativeHistory} = createStandardHistory();
        relativeHistory.push("/1/");
        relativeHistory.push("/2/");
        relativeHistory.push("/3/");
        relativeHistory.push("/4/");
        relativeHistory.push("/5/");
        return {
          memoryHistory,
          relativeHistory,
          expectPageNumber: (n) =>
            expectPageNumber(relativeHistory, memoryHistory, n),
        };
      };
      function expectPageNumber(relativeHistory, memoryHistory, n) {
        expect(relativeHistory.location.pathname).toEqual(`/${n}/`);
        expect(memoryHistory.location.pathname).toEqual(`/my/gateway/${n}/`);
      }
      describe("go, goForward, and goBack", () => {
        it("navigates back three, then forward two", () => {
          const {relativeHistory, expectPageNumber} = createFivePageHistory();
          expectPageNumber(5);
          relativeHistory.go(-3);
          expectPageNumber(2);
          relativeHistory.go(2);
          expectPageNumber(4);
        });

        it("goes back", () => {
          const {relativeHistory, expectPageNumber} = createFivePageHistory();
          expectPageNumber(5);
          relativeHistory.goBack();
          expectPageNumber(4);
          relativeHistory.goBack();
          expectPageNumber(3);
        });

        it("goes forward", () => {
          const {relativeHistory, expectPageNumber} = createFivePageHistory();
          expectPageNumber(5);
          relativeHistory.go(-2);
          relativeHistory.goBack();
          expectPageNumber(2);
          relativeHistory.goForward();
          expectPageNumber(3);
          relativeHistory.goForward();
          expectPageNumber(4);
        });

        it("doesn't overflow; stops at top of history stack", () => {
          const {relativeHistory, expectPageNumber} = createFivePageHistory();
          relativeHistory.goBack();
          expectPageNumber(4);
          relativeHistory.go(2);
        });

        it("doesn't underflow; stops at bottom of history stack", () => {
          const {relativeHistory, expectPageNumber} = createFivePageHistory();
          relativeHistory.go(-4);
          expectPageNumber(1);
          relativeHistory.go(-2);
          expect(relativeHistory.location.pathname).toEqual("/foo/bar/");
          // Reset console.error to a clean mock to satisfy afterEach check from
          // configureEnzyme()
          // $FlowExpectedError
          console.error = jest.fn();
        });

        it("accounts for interleaved changes in the delegate state", () => {
          const {memoryHistory, relativeHistory} = createStandardHistory();
          relativeHistory.push("/1/");
          memoryHistory.push("/my/gateway/2/");
          relativeHistory.push("/3/");
          memoryHistory.push("/my/gateway/4/");
          relativeHistory.push("/5/");

          expectPageNumber(relativeHistory, memoryHistory, 5);
          relativeHistory.go(-3);
          expectPageNumber(relativeHistory, memoryHistory, 2);
          relativeHistory.go(2);
          expectPageNumber(relativeHistory, memoryHistory, 4);
        });
      });

      describe("V4 History properties and methods", () => {
        // history location states update simultaneously
        // in both Relative and delegate histories:
        // action: the last change made to the history state
        // length: the number of entries of in the history state
        // index: the index of the current location in the entries array
        // entries: array of locations collected in history
        describe("properties: action, length, index, entries", () => {
          const {memoryHistory, relativeHistory} = createFivePageHistory();
          it("history state stays synced between relative and delegate histories", () => {
            // verify initial state after creating history
            expect(relativeHistory.action).toEqual("PUSH");
            expect(relativeHistory.length).toEqual(6);
            expect(relativeHistory.index).toEqual(5);
            relativeHistory.entries.forEach((historyEntry, idx) => {
              expect(historyEntry).toEqual(
                expect.objectContaining(relativeEntries[idx])
              );
            });
            expect(memoryHistory.action).toEqual("PUSH");
            expect(memoryHistory.length).toEqual(6);
            expect(memoryHistory.index).toEqual(5);
            memoryHistory.entries.forEach((memoryEntry, idx) => {
              expect(memoryEntry).toEqual(
                expect.objectContaining(memoryEntries[idx])
              );
            });
            // go back 4 locations
            relativeHistory.go(-4);
            // check that history state updated as expected
            // in both relative and delegate histories
            expect(relativeHistory.action).toEqual("POP");
            expect(relativeHistory.length).toEqual(6);
            expect(relativeHistory.index).toEqual(1);
            relativeHistory.entries.forEach((historyEntry, idx) => {
              expect(historyEntry).toEqual(
                expect.objectContaining(relativeEntries[idx])
              );
            });
            expect(memoryHistory.action).toEqual("POP");
            expect(memoryHistory.length).toEqual(6);
            expect(memoryHistory.index).toEqual(1);
            memoryHistory.entries.forEach((memoryEntry, idx) => {
              expect(memoryEntry).toEqual(
                expect.objectContaining(memoryEntries[idx])
              );
            });
          });
        });
        // The block method is utilized to prevent any location transitions
        describe("block method", () => {
          describe("at root", () => {
            const {memoryHistory, relativeHistory} = createHistory("/", "/");
            let unblockFn;
            it("should prevent location updates if delegate is blocked", () => {
              unblockFn = memoryHistory.block();
              relativeHistory.push(stringToLocation("/about/"));
              expect(relativeHistory.location.pathname).toEqual("/");
              expect(memoryHistory.location.pathname).toEqual("/");
            });
            it("should update after unblocking", () => {
              unblockFn();
              relativeHistory.push(stringToLocation("/about/"));
              expect(relativeHistory.location.pathname).toEqual("/about/");
              expect(memoryHistory.location.pathname).toEqual("/about/");
            });
            it("relativeHistory can prevent transitions", () => {
              unblockFn = relativeHistory.block();
              relativeHistory.push(stringToLocation("/"));
              expect(relativeHistory.location.pathname).toEqual("/about/");
              expect(memoryHistory.location.pathname).toEqual("/about/");
            });
            it("hook from relativeHistory can reenable transitions", () => {
              unblockFn();
              relativeHistory.push(stringToLocation("/"));
              expect(relativeHistory.location.pathname).toEqual("/");
              expect(memoryHistory.location.pathname).toEqual("/");
            });
          });
          describe("at nonroot", () => {
            const {memoryHistory, relativeHistory} = createHistory(
              "/main/directory/",
              "/main/directory/home/"
            );
            let unblockFn;
            it("should prevent location updates if delegate is blocked at nonroot", () => {
              unblockFn = memoryHistory.block();
              relativeHistory.push(stringToLocation("/about"));
              expect(relativeHistory.location.pathname).toEqual("/home/");
              expect(memoryHistory.location.pathname).toEqual(
                "/main/directory/home/"
              );
            });
            it("should update after unblocking", () => {
              unblockFn();
              relativeHistory.push(stringToLocation("/about/"));
              expect(relativeHistory.location.pathname).toEqual("/about/");
              expect(memoryHistory.location.pathname).toEqual(
                "/main/directory/about/"
              );
            });
          });
        });
      });

      describe("createHref", () => {
        it("should return DOM-space at root", () => {
          expect(
            createHistory(
              "/my/gateway/",
              "/my/gateway/"
            ).relativeHistory.createHref(stringToLocation("/favicon.png"))
          ).toEqual("favicon.png");
        });
        it("should return DOM-space at non-root", () => {
          expect(
            createStandardHistory().relativeHistory.createHref(
              stringToLocation("/favicon.png")
            )
          ).toEqual("../../favicon.png");
        });
        it("should traverse up and back down the tree", () => {
          expect(
            createStandardHistory().relativeHistory.createHref(
              stringToLocation("/baz/quux/data.csv")
            )
          ).toEqual("../../baz/quux/data.csv");
        });
        it("should resolve the root", () => {
          expect(
            createStandardHistory().relativeHistory.createHref(
              stringToLocation("/")
            )
          ).toEqual("../../");
        });
      });
    });

    describe("with another instance of itself as the delegate", () => {
      it("seems to work", () => {
        // Why? Because it's classy, mostly.
        const h0 = createMemoryHistory({initialEntries: ["/a1/a2/b1/b2/c/"]});
        const h1 = createRelativeHistory(h0, "/a1/a2/");
        const h2 = createRelativeHistory(h1, "/b1/b2/");
        expect(h2.location.pathname).toEqual("/c/");
        h2.push("/c1/c2/");
        expect(h0.location.pathname).toEqual("/a1/a2/b1/b2/c1/c2/");
        expect(h1.location.pathname).toEqual("/b1/b2/c1/c2/");
        expect(h2.location.pathname).toEqual("/c1/c2/");
        h2.goBack();
        expect(h0.location.pathname).toEqual("/a1/a2/b1/b2/c/");
        expect(h1.location.pathname).toEqual("/b1/b2/c/");
        expect(h2.location.pathname).toEqual("/c/");
      });
    });
  });

  describe("in a React app", () => {
    class MainPage extends React.Component<{|
      +history: any,
    |}> {
      render() {
        const {history} = this.props;
        return (
          <div>
            <h1>Welcome</h1>
            <p>
              <i>currently viewing route:</i>{" "}
              <tt>{history.location.pathname}</tt>
            </p>
            <img
              alt="logo"
              src={history.createHref(stringToLocation("/logo.png"))}
            />
            <nav>
              <Link to="/about/">About us</Link>
            </nav>
            <main>
              <Route path="/about/" component={AboutPage} />
            </main>
          </div>
        );
      }
    }
    class AboutPage extends React.Component<{|+router: Router|}> {
      render() {
        return <p>content coming soon</p>;
      }
    }
    class App extends React.Component<{|+history: History|}> {
      render() {
        return (
          <Router history={this.props.history}>
            <Route path="/" component={MainPage} />
          </Router>
        );
      }
    }

    function test(basename) {
      it("should render to proper markup at index", () => {
        const {memoryHistory, relativeHistory} = createHistory(
          basename,
          normalize(basename + "/")
        );
        const e = render(<App history={relativeHistory} />);
        expect(e.find("tt").text()).toEqual("/");
        expect(e.find("img").attr("src")).toEqual("logo.png");
        expect(e.find("a").attr("href")).toEqual("about/");
        expect(e.find("main").text()).toEqual("");
        expect(memoryHistory.location.pathname).toEqual(
          normalize(basename + "/")
        );
      });

      it("should render to proper markup at subroute", () => {
        const {memoryHistory, relativeHistory} = createHistory(
          basename,
          normalize(basename + "/about/")
        );
        const e = render(<App history={relativeHistory} />);
        expect(e.find("tt").text()).toEqual("/about/");
        expect(e.find("img").attr("src")).toEqual("../logo.png");
        expect(e.find("a").attr("href")).toEqual("../about/");
        expect(e.find("main").children()).toHaveLength(1);
        expect(e.find("main").text()).toEqual("content coming soon");
        expect(memoryHistory.location.pathname).toEqual(
          normalize(basename + "/about/")
        );
        expect(e.html()).toEqual(
          render(
            <App history={createHistory("/", "/about/").relativeHistory} />
          ).html()
        );
      });

      function agreeWithServer(path) {
        const server = render(
          <App history={createHistory("/", path).relativeHistory} />
        );
        const client = render(
          <App
            history={
              createHistory(basename, normalize(basename + path))
                .relativeHistory
            }
          />
        );
        expect(server.html()).toEqual(client.html());
      }
      it("should agree between client and server at index", () => {
        agreeWithServer("/");
      });
      it("should agree between client and server at subroute", () => {
        agreeWithServer("/about/");
      });

      function click(link) {
        // React Router only transitions if the event appears to be from
        // a left-click (button index 0) event on a mouse.
        const event = {button: 0};
        link.simulate("click", event);
      }

      it("should properly transition when clicking a link", () => {
        const {memoryHistory, relativeHistory} = createHistory(
          basename,
          normalize(basename + "/")
        );
        const e = mount(<App history={relativeHistory} />);
        expect(e.find("tt").text()).toEqual("/");
        expect(e.find("Link")).toHaveLength(1);
        click(e.find("a"));
        expect(relativeHistory.location.pathname).toEqual("/about/");
        expect(memoryHistory.location.pathname).toEqual(
          normalize(basename + "/about/")
        );
      });
    }

    describe("when hosted at root", () => {
      test("/");
    });

    describe("when hosted at a non-root gateway", () => {
      test("/some/arbitrary/gateway/");
    });
  });
});
