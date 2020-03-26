// @flow

import React from "react";
import {shallow} from "enzyme";
import {TableRow, PaddingRow} from "./TableRow";

import {COLUMNS} from "./sharedTestUtils";
require("../../../webutil/testUtil").configureEnzyme();
require("../../../webutil/testUtil").configureAphrodite();

describe("explorer/legacy/pagerankTable/TableRow", () => {
  function example() {
    return shallow(
      <TableRow
        depth={1}
        indent={1}
        description={<span data-test-description={true} />}
        multiuseColumn={"50.00%"}
        cred={133.7}
        showPadding={false}
      >
        <div data-test-children={true} />{" "}
      </TableRow>
    );
  }
  it("depth parameter changes the color, but not the indentation", () => {
    for (const depth of [0, 1, 2]) {
      const el = shallow(
        <TableRow
          depth={depth}
          indent={1}
          showPadding={false}
          description={<span data-test-description={true} />}
          multiuseColumn={"50.00%"}
          cred={133.7}
        >
          <div data-test-children={true} />
        </TableRow>
      );
      const tr = el.find("tr");
      const trStyle = tr.props().style;
      const trClassName = tr.props().className;
      const buttonStyle = el.find("button").props().style;
      expect({depth, trStyle, trClassName, buttonStyle}).toMatchSnapshot();
    }
  });
  it("indent parameter changes the button indentation", () => {
    for (const indent of [0, 1, 2]) {
      const el = shallow(
        <TableRow
          depth={3}
          indent={indent}
          showPadding={false}
          description={<span data-test-description={true} />}
          multiuseColumn={"50.00%"}
          cred={133.7}
        >
          <div data-test-children={true} />
        </TableRow>
      );
      const tr = el.find("tr");
      const trStyle = tr.props().style;
      const trClassName = tr.props().className;
      const buttonStyle = el.find("button").props().style;
      expect({indent, trStyle, trClassName, buttonStyle}).toMatchSnapshot();
    }
  });
  it("expand button toggles symbol based on expansion state", () => {
    const el = example();
    el.setState({expanded: false});
    expect(el.find("button").text()).toEqual("+");
    el.setState({expanded: true});
    expect(el.find("button").text()).toEqual("\u2212");
  });
  it("clicking the expand button toggles expansion state", () => {
    const el = example();
    el.setState({expanded: false});
    el.find("button").simulate("click");
    expect(el.state().expanded).toBe(true);
    el.find("button").simulate("click");
    expect(el.state().expanded).toBe(false);
  });
  it("defaults to not expanded", () => {
    const el = example();
    expect(el.state().expanded).toBe(false);
  });
  it("displays children only when expanded", () => {
    const el = example();
    el.setState({expanded: false});
    expect(el.find({"data-test-children": true})).toHaveLength(0);
    el.setState({expanded: true});
    expect(el.find({"data-test-children": true})).toHaveLength(1);
  });
  it("has the correct number of columns", () => {
    const el = example();
    expect(el.find("td")).toHaveLength(COLUMNS().length);
  });
  it("can display literal text in the multiuseColumn", () => {
    const index = COLUMNS().indexOf("");
    expect(index).not.toEqual(-1);
    const td = example().find("td").at(index);
    expect(td.text()).toEqual("50.00%");
  });
  it("displays general react nodes in the multiuseColumn", () => {
    const index = COLUMNS().indexOf("");
    expect(index).not.toEqual(-1);
    const el = example();
    const multiuseColumn = <span data-test-multiuse={true} />;
    el.setProps({multiuseColumn});
    const td = el.find("td").at(index);
    expect(td.find({"data-test-multiuse": true})).toHaveLength(1);
  });
  it("displays formatted cred in the correct column", () => {
    const index = COLUMNS().indexOf("Cred");
    expect(index).not.toEqual(-1);
    const td = example().find("td").at(index);
    expect(td.text()).toEqual("133.70");
  });
  it("displays the description in the correct column", () => {
    const index = COLUMNS().indexOf("Description");
    expect(index).not.toEqual(-1);
    const td = example().find("td").at(index);
    expect(td.find({"data-test-description": true})).toHaveLength(1);
  });
  it("doesn't create extra padding rows if showPadding=false", () => {
    const el = example();
    expect(el.find("tr")).toHaveLength(1);
  });
  describe("can add padding rows above and below the row", () => {
    function paddingExample() {
      return shallow(
        <TableRow
          depth={2}
          indent={1}
          description={<span data-test-description={true} />}
          multiuseColumn={"50.00%"}
          cred={133.7}
          showPadding={true}
        >
          <div data-test-children={true} />
        </TableRow>
      );
    }
    it("has two identical padding rows", () => {
      const paddingRows = paddingExample().find(PaddingRow);
      expect(paddingRows).toHaveLength(2);
      expect(paddingRows.at(0)).toEqual(paddingRows.at(1));
    });
    it("padding rows are first and last children", () => {
      const children = paddingExample().children();
      expect(children.first().is(PaddingRow)).toBe(true);
      expect(children.last().is(PaddingRow)).toBe(true);
    });
    it("padding rows are first and last children after expansion", () => {
      const el = paddingExample();
      el.setState({expanded: true});
      const children = el.children();
      expect(children.first().is(PaddingRow)).toBe(true);
      expect(children.last().is(PaddingRow)).toBe(true);
    });
    it("padding rows have the right number of tds", () => {
      const el = paddingExample();
      const paddingRow = shallow(
        <PaddingRow backgroundColor="rgba(0,0,0,0)" />
      );
      expect(paddingRow.find("td")).toHaveLength(el.find("td").length);
    });
    it("padding rows were passed the right color", () => {
      const el = paddingExample();
      const pr = el.find(PaddingRow).at(0);
      const tr = el.find("tr");
      const prBackgroundColor = pr.props().backgroundColor;
      expect(tr.props().style.backgroundImage).toEqual(
        `linear-gradient(to top, ${prBackgroundColor}, ${prBackgroundColor}), linear-gradient(to top, #D8E1E8, #D8E1E8)`
      );
    });
    it("padding rows properly set the background color", () => {
      const bgColor = "rgba(3, 13, 37, 0.1337)";
      const pr = shallow(<PaddingRow backgroundColor={bgColor} />);
      expect(pr.find("tr").props().style.backgroundColor).toEqual(bgColor);
    });
    it("padding rows set height > 0", () => {
      const pr = shallow(<PaddingRow backgroundColor="rgba(0, 0, 0, 0)" />);
      expect(pr.find("tr").props().style.height).toBeGreaterThan(0);
    });
  });
});
