// @flow
import {StyleSheet} from "aphrodite/no-important";
import {shallow} from "enzyme";
import React from "react";
import {Link as RouterLink} from "react-router-dom";

import Link from "./Link";

require("./testUtil").configureAphrodite();
require("./testUtil").configureEnzyme();

describe("webutil/Link", () => {
  const styles = StyleSheet.create({
    x: {fontWeight: "bold"},
  });

  // Static type checks
  void [
    /* eslint-disable react/jsx-key */
    // Must specify either `href` or `to`
    <Link href="https://example.com/">click me</Link>,
    <Link to="/prototype/">click me, too</Link>,
    // $FlowExpectedError[incompatible-type]
    <Link>missing to/href</Link>,

    // May specify styles
    <Link href="#" styles={[styles.x, styles.y /* nonexistent */]} />,

    // May specify extra properties
    <Link href="#" onClick={() => void alert("hi")} tabIndex={3} />,
    /* eslint-enable react/jsx-key */
  ];

  it("renders a styled external link", () => {
    const element = shallow(<Link href="https://example.com/">click me</Link>);
    expect(element.type()).toBe("a");
    expect(element.prop("href")).toEqual("https://example.com/");
    expect(element.children().text()).toEqual("click me");
    expect(typeof element.prop("className")).toBe("string");
  });

  it("renders a styled router link", () => {
    const element = shallow(<Link to="/prototype/">check it out</Link>);
    expect(element.type()).toEqual(RouterLink);
    expect(element.prop("to")).toEqual("/prototype/");
    expect(element.children().text()).toEqual("check it out");
    expect(typeof element.prop("className")).toBe("string");
  });

  it("fails if neither `to` nor `href` is provided", () => {
    // $FlowExpectedError[incompatible-type]
    const component = <Link>uhhhhh</Link>;
    expect(() => {
      shallow(component);
    }).toThrow("Must specify either 'to' or 'href'.");
  });

  it("fails if router link omits a trailing slash", () => {
    const component = <Link to="/foo" />;
    expect(() => {
      shallow(component);
    }).toThrow("'to' prop must specify route with trailing slash.");
  });

  it("permits external link to omit a trailing slash", () => {
    const component = <Link href="/foo" />;
    expect(() => {
      shallow(component);
    }).not.toThrow();
  });

  it("has deterministic className", () => {
    const e1 = shallow(<Link href="#" />);
    const e2 = shallow(<Link href="#" />);
    expect(e2.prop("className")).toEqual(e1.prop("className"));
  });

  it("adds specified Aphrodite styles", () => {
    const e1 = shallow(<Link href="#" />);
    const e2 = shallow(<Link href="#" styles={[styles.x]} />);
    expect(e2.prop("className")).not.toEqual(e1.prop("className"));
    expect(e2.props()).not.toHaveProperty("styles");
  });

  it("forwards class name", () => {
    const e1 = shallow(<Link href="#" />);
    const e2 = shallow(<Link href="#" className="ohai" />);
    expect(e2.prop("className")).toEqual(e1.prop("className") + " ohai");
  });

  it("forwards other props, like `onClick` and `tabIndex`", () => {
    const fn = () => {};
    const element = shallow(<Link href="#" onClick={fn} tabIndex={77} />);
    expect(element.prop("onClick")).toBe(fn);
    expect(element.prop("tabIndex")).toBe(77);
  });
});
