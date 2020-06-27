// @flow

import React, {type Node as ReactNode} from "react";
import {Router, Route, Link} from "react-router";
import {mount, render} from "enzyme";

import normalize from "../util/pathNormalize";
import type {History /* actually `any` */} from "history";
import createMemoryHistory from "history/createMemoryHistory";
import createRelativeHistory from "./createRelativeHistory";

require("./testUtil").configureEnzyme();

describe("webutil/createRelativeHistory", () => {
  function createHistory(basename: string, path: string) {
    const memoryHistory = createMemoryHistory(path);
    const relativeHistory = createRelativeHistory(memoryHistory, basename);
    return {memoryHistory, relativeHistory};
  }

  describe("by direct interaction", () => {
    describe("construction", () => {
      it("should require a valid `history` implementation", () => {
        const historyV4Object = {
          length: 1,
          action: "POP",
          location: {
            pathname: "/foo/",
            search: "",
            hash: "",
            key: "123456",
            state: undefined,
          },
          createHref: () => "wat",
          push: () => undefined,
          replace: () => undefined,
          go: () => undefined,
          goBack: () => undefined,
          goForward: () => undefined,
          canGo: () => true,
          block: () => undefined,
          listen: () => undefined,
        };
        expect(() => createRelativeHistory(historyV4Object, "/")).toThrow(
          "delegate: expected history@3 implementation, got: [object Object]"
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
      it("should return React-space from `getCurrentLocation`", () => {
        const {memoryHistory, relativeHistory} = createHistory(
          "/",
          "/foo/bar/"
        );
        expect(relativeHistory.getCurrentLocation().pathname).toEqual(
          "/foo/bar/"
        );
        memoryHistory.push("/baz/quux/");
        expect(relativeHistory.getCurrentLocation().pathname).toEqual(
          "/baz/quux/"
        );
      });
      it("should return DOM-space from `createHref` at root", () => {
        expect(
          createHistory("/", "/").relativeHistory.createHref("/favicon.png")
        ).toEqual("favicon.png");
      });
      it("should return DOM-space from `createHref` at non-root", () => {
        expect(
          createHistory("/", "/foo/bar/").relativeHistory.createHref(
            "/favicon.png"
          )
        ).toEqual("../../favicon.png");
      });
      it("should accept a location string for `push`", () => {
        const {memoryHistory, relativeHistory} = createHistory(
          "/",
          "/foo/bar/"
        );
        relativeHistory.push("/baz/quux/#browns");
        expect(memoryHistory.getCurrentLocation()).toEqual(
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
        relativeHistory.push({pathname: "/baz/quux/", hash: "#browns"});
        expect(memoryHistory.getCurrentLocation()).toEqual(
          expect.objectContaining({
            pathname: "/baz/quux/",
            search: "",
            hash: "#browns",
            state: undefined,
          })
        );
      });
    });

    describe('with a non-root basename ("/my/gateway/")', () => {
      const createStandardHistory = () =>
        createHistory("/my/gateway/", "/my/gateway/foo/bar/");

      describe("getCurrentLocation", () => {
        it("should return the initial location, in React-space", () => {
          const {relativeHistory} = createStandardHistory();
          expect(relativeHistory.getCurrentLocation().pathname).toEqual(
            "/foo/bar/"
          );
        });
        it("should accommodate changes in the delegate location", () => {
          const {memoryHistory, relativeHistory} = createStandardHistory();
          memoryHistory.push("/my/gateway/baz/quux/");
          expect(relativeHistory.getCurrentLocation().pathname).toEqual(
            "/baz/quux/"
          );
        });
        it("should throw if the delegate moves out of basename scope", () => {
          const {memoryHistory, relativeHistory} = createStandardHistory();
          expect(relativeHistory.getCurrentLocation().pathname).toEqual(
            "/foo/bar/"
          );
          memoryHistory.push("/not/my/gateway/baz/quux/");
          expect(() => relativeHistory.getCurrentLocation()).toThrow(
            'basename violation: "/my/gateway/" is not ' +
              'a prefix of "/not/my/gateway/baz/quux/"'
          );
        });
      });

      describe("listenBefore", () => {
        function testListener(target: "RELATIVE" | "MEMORY") {
          const {memoryHistory, relativeHistory} = createStandardHistory();
          const listener = jest.fn();
          relativeHistory.listenBefore(listener);
          expect(listener).toHaveBeenCalledTimes(0);
          listener.mockImplementationOnce((newLocation) => {
            // We should _not_ already have transitioned. (Strictly,
            // this doesn't mean that the pathnames must not be
            // equal---an event could be fired if, say, only the hash
            // changes---but it suffices for our test cases.)
            expect(relativeHistory.getCurrentLocation().pathname).not.toEqual(
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
          const unlisten = relativeHistory.listenBefore(listener);

          expect(listener).toHaveBeenCalledTimes(0);
          memoryHistory.push("/my/gateway/baz/quux/#browns");
          expect(listener).toHaveBeenCalledTimes(1);

          unlisten();
          memoryHistory.push("/my/gateway/some/thing/else/");
          expect(listener).toHaveBeenCalledTimes(1);
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
            expect(relativeHistory.getCurrentLocation().pathname).toEqual(
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

      // I have no idea what `transitionTo` is supposed to do. One would
      // think that it effects a transition, but one would be wrong:
      //
      //     > var mh = require("history/lib/createMemoryHistory").default();
      //     > mh.transitionTo("/foo/");
      //     > mh.getCurrentLocation().pathname;
      //     '/'
      //
      // The best that I can think of to do is to verify that the
      // appropriate argument is passed along.
      describe("transitionTo", () => {
        it("forwards a browser-space string", () => {
          const {memoryHistory, relativeHistory} = createStandardHistory();
          const spy = jest.spyOn(memoryHistory, "transitionTo");
          relativeHistory.transitionTo("/baz/quux/");
          expect(spy).toHaveBeenCalledTimes(1);
          expect(spy).toHaveBeenCalledWith("/my/gateway/baz/quux/");
        });
        it("forwards a browser-space location object", () => {
          const {memoryHistory, relativeHistory} = createStandardHistory();
          const spy = jest.spyOn(memoryHistory, "transitionTo");
          relativeHistory.transitionTo({
            pathname: "/baz/quux/",
            hash: "#browns",
            state: "california",
          });
          expect(spy).toHaveBeenCalledTimes(1);
          expect(spy).toHaveBeenCalledWith({
            pathname: "/my/gateway/baz/quux/",
            hash: "#browns",
            state: "california",
          });
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
          expect(memoryHistory.getCurrentLocation()).toEqual(
            expect.objectContaining({
              pathname: "/my/gateway/baz/quux/",
              search: "",
              hash: "#browns",
              state: undefined,
              action: "POP",
            })
          );
          expect(relativeHistory.getCurrentLocation()).toEqual(
            expect.objectContaining({
              pathname: "/baz/quux/",
              search: "",
              hash: "#browns",
              state: undefined,
              action: "POP",
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
          expect(memoryHistory.getCurrentLocation()).toEqual(
            expect.objectContaining({
              pathname: "/my/gateway/baz/quux/",
              search: "",
              hash: "#browns",
              state: "california",
              action: "POP",
            })
          );
          expect(relativeHistory.getCurrentLocation()).toEqual(
            expect.objectContaining({
              pathname: "/baz/quux/",
              search: "",
              hash: "#browns",
              state: "california",
              action: "POP",
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

      describe("go, goForward, and goBack", () => {
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
          expect(relativeHistory.getCurrentLocation().pathname).toEqual(
            `/${n}/`
          );
          expect(memoryHistory.getCurrentLocation().pathname).toEqual(
            `/my/gateway/${n}/`
          );
        }

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

        it("warns on overflow", () => {
          const {relativeHistory} = createFivePageHistory();
          relativeHistory.goBack();
          // Setup by configureEnzyme()
          const errorMock: JestMockFn<
            $ReadOnlyArray<void>,
            void
          > = (console.error: any);
          expect(errorMock).not.toHaveBeenCalled();
          relativeHistory.go(2);
          expect(errorMock).toHaveBeenCalledTimes(1);
          expect(errorMock.mock.calls[0][0]).toMatch(
            /Warning:.*there is not enough history/
          );
          // Reset console.error to a clean mock to satisfy afterEach check from
          // configureEnzyme()
          // $FlowExpectedError
          console.error = jest.fn();
        });

        it("warns on underflow", () => {
          const {relativeHistory} = createFivePageHistory();
          // Setup by configureEnzyme()
          const errorMock: JestMockFn<
            $ReadOnlyArray<void>,
            void
          > = (console.error: any);
          relativeHistory.go(-4);
          expect(errorMock).not.toHaveBeenCalled();
          relativeHistory.go(-2);
          expect(errorMock).toHaveBeenCalledTimes(1);
          expect(errorMock.mock.calls[0][0]).toMatch(
            /Warning:.*there is not enough history/
          );
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

      describe("createKey", () => {
        it("returns a string", () => {
          const {relativeHistory} = createStandardHistory();
          const key = relativeHistory.createKey(); // nondeterministic
          expect(key).toEqual(expect.stringContaining(""));
        });
        it("delegates", () => {
          const {memoryHistory, relativeHistory} = createStandardHistory();
          const secret = "ouagadougou";
          memoryHistory.createKey = jest
            .fn()
            .mockImplementationOnce(() => secret);
          expect(relativeHistory.createKey()).toEqual(secret);
          expect(memoryHistory.createKey).toHaveBeenCalledTimes(1);
        });
      });

      describe("createPath", () => {
        // We have no idea what this function is supposed to do. It
        // shouldn't be called. If it is, fail.
        it("throws unconditionally", () => {
          const {relativeHistory} = createStandardHistory();
          expect(() => relativeHistory.createPath("/wat/")).toThrow(
            "createPath is not part of the public API"
          );
        });
      });

      describe("createHref", () => {
        it("should return DOM-space at root", () => {
          expect(
            createHistory(
              "/my/gateway/",
              "/my/gateway/"
            ).relativeHistory.createHref("/favicon.png")
          ).toEqual("favicon.png");
        });
        it("should return DOM-space at non-root", () => {
          expect(
            createStandardHistory().relativeHistory.createHref("/favicon.png")
          ).toEqual("../../favicon.png");
        });
        it("should traverse up and back down the tree", () => {
          expect(
            createStandardHistory().relativeHistory.createHref(
              "/baz/quux/data.csv"
            )
          ).toEqual("../../baz/quux/data.csv");
        });
        it("should resolve the root", () => {
          expect(
            createStandardHistory().relativeHistory.createHref("/")
          ).toEqual("../../");
        });
      });

      describe("createLocation", () => {
        it("should return React-space at root", () => {
          expect(
            createHistory(
              "/my/gateway/",
              "/my/gateway/"
            ).relativeHistory.createLocation("/baz/quux/")
          ).toEqual(expect.objectContaining({pathname: "/baz/quux/"}));
        });
        it("should return React-space at non-root", () => {
          expect(
            createStandardHistory().relativeHistory.createLocation("/baz/quux/")
          ).toEqual(expect.objectContaining({pathname: "/baz/quux/"}));
        });
        it("should include the given action", () => {
          expect(
            createStandardHistory().relativeHistory.createLocation(
              "/baz/quux/",
              "REPLACE"
            )
          ).toEqual(expect.objectContaining({action: "REPLACE"}));
        });
      });
    });

    describe("with another instance of itself as the delegate", () => {
      it("seems to work", () => {
        // Why? Because it's classy, mostly.
        const h0 = createMemoryHistory("/a1/a2/b1/b2/c/");
        const h1 = createRelativeHistory(h0, "/a1/a2/");
        const h2 = createRelativeHistory(h1, "/b1/b2/");
        expect(h2.getCurrentLocation().pathname).toEqual("/c/");
        h2.push("/c1/c2/");
        expect(h0.getCurrentLocation().pathname).toEqual("/a1/a2/b1/b2/c1/c2/");
        expect(h1.getCurrentLocation().pathname).toEqual("/b1/b2/c1/c2/");
        expect(h2.getCurrentLocation().pathname).toEqual("/c1/c2/");
        h2.goBack();
        expect(h0.getCurrentLocation().pathname).toEqual("/a1/a2/b1/b2/c/");
        expect(h1.getCurrentLocation().pathname).toEqual("/b1/b2/c/");
        expect(h2.getCurrentLocation().pathname).toEqual("/c/");
      });
    });
  });

  describe("in a React app", () => {
    class MainPage extends React.Component<{|
      +router: Router,
      +children: ReactNode,
    |}> {
      render() {
        const {router} = this.props;
        return (
          <div>
            <h1>Welcome</h1>
            <p>
              <i>currently viewing route:</i>{" "}
              <tt>{router.getCurrentLocation().pathname}</tt>
            </p>
            <img alt="logo" src={router.createHref("/logo.png")} />
            <nav>
              <Link to="/about/">About us</Link>
            </nav>
            <main>{this.props.children}</main>
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
            <Route path="/" component={MainPage}>
              <Route path="/about/" component={AboutPage} />
            </Route>
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
        expect(e.find("main").children()).toHaveLength(0);
        expect(e.find("main").text()).toEqual("");
        expect(memoryHistory.getCurrentLocation().pathname).toEqual(
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
        expect(memoryHistory.getCurrentLocation().pathname).toEqual(
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
        expect(relativeHistory.getCurrentLocation().pathname).toEqual(
          "/about/"
        );
        expect(memoryHistory.getCurrentLocation().pathname).toEqual(
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
