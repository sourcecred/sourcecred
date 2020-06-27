// @flow

import React, {type Node as ReactNode} from "react";
import {IndexRoute, Link, Router, Route} from "react-router";
import {mount, render} from "enzyme";

import {Assets} from "./assets";
import withAssets from "./withAssets";

import createMemoryHistory from "history/createMemoryHistory";
import createRelativeHistory from "./createRelativeHistory";

require("./testUtil").configureEnzyme();

describe("webutil/withAssets", () => {
  function createHistory(basename, path) {
    const memoryHistory = createMemoryHistory(path);
    const relativeHistory = createRelativeHistory(memoryHistory, basename);
    return {memoryHistory, relativeHistory};
  }

  class FaviconRenderer extends React.Component<{|+assets: Assets|}> {
    render() {
      const {assets} = this.props;
      return (
        <div>
          <img alt="favicon" src={assets.resolve("/favicon.png")} />
        </div>
      );
    }
  }

  class CaptionedFaviconRenderer extends React.Component<{|
    +assets: Assets,
    +children: ReactNode,
  |}> {
    render() {
      const {assets, children} = this.props;
      return (
        <div>
          <img alt="favicon" src={assets.resolve("/favicon.png")} />
          <figcaption>{children}</figcaption>
        </div>
      );
    }
  }

  it("enhances a component with no extra props", () => {
    const {relativeHistory} = createHistory("/foo/", "/foo/bar/");
    const component = (
      <Router history={relativeHistory}>
        <Route path="/bar/" component={withAssets(FaviconRenderer)} />
      </Router>
    );
    const e = render(component);
    expect(e.find("img").attr("src")).toEqual("../favicon.png");
  });

  it("enhances a component with children", () => {
    const {relativeHistory} = createHistory("/foo/", "/foo/bar/baz/");
    class Caption extends React.Component<{||}> {
      render() {
        return <span>our favicon</span>;
      }
    }
    const component = (
      <Router history={relativeHistory}>
        <Route path="/bar/" component={withAssets(CaptionedFaviconRenderer)}>
          <Route path="/bar/baz/" component={Caption} />
        </Route>
      </Router>
    );
    const e = render(component);
    expect(e.find("img").attr("src")).toEqual("../../favicon.png");
    expect(e.find("figcaption").text()).toEqual("our favicon");
  });

  it("updates on page change", () => {
    const {relativeHistory} = createHistory("/foo/", "/foo/bar/");
    class LinkToCaption extends React.Component<{||}> {
      render() {
        return <Link to="/bar/captioned/">click here</Link>;
      }
    }
    class Caption extends React.Component<{||}> {
      render() {
        return <span>our favicon</span>;
      }
    }
    const component = (
      <Router history={relativeHistory}>
        <Route path="/bar/" component={withAssets(CaptionedFaviconRenderer)}>
          <IndexRoute component={LinkToCaption} />
          <Route path="/bar/captioned/" component={Caption} />
        </Route>
      </Router>
    );
    const e = mount(component);
    expect(e.find("img").prop("src")).toEqual("../favicon.png");
    expect(e.find("figcaption").text()).toEqual("click here");
    function click(link) {
      // React Router only transitions if the event appears to be from
      // a left-click (button index 0) event on a mouse.
      const event = {button: 0};
      link.simulate("click", event);
    }
    click(e.find("a"));
    expect(e.find("img").prop("src")).toEqual("../../favicon.png");
    expect(e.find("figcaption").text()).toEqual("our favicon");
  });
});
