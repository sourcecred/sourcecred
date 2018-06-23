// @flow

import * as R from "./relationalView";

describe("plugins/github/relationalView", () => {
  const data = require("./demoData/example-github");
  // Sharing this state is OK because it's just a view - no mutation allowed!
  const view = new R.RelationalView(data);

  function assertNotNull<T>(x: ?T): T {
    if (x == null) {
      throw new Error(`Assertion fail: ${String(x)} `);
    }
    return x;
  }
  const repos = () => Array.from(view.repos());
  it("there is one repository", () => {
    expect(repos()).toHaveLength(1);
  });

  const repo = () => assertNotNull(repos()[0]);
  it("repo matches snapshot", () => {
    expect(repo()).toMatchSnapshot();
  });

  it("repo retrievable by address", () => {
    expect(view.repo(repo().address)).toEqual(repo());
  });

  const issue = () => assertNotNull(view.issue(repo().issues[1]));
  it("issue matches snapshot", () => {
    expect(issue()).toMatchSnapshot();
  });
  it("issue retrievable by address", () => {
    expect(view.issue(issue().address)).toEqual(issue());
  });

  const pull = () => assertNotNull(view.pull(repo().pulls[1]));
  it("pull matches snapshot", () => {
    expect(pull()).toMatchSnapshot();
  });
  it("pull retrievable by address", () => {
    expect(view.pull(pull().address)).toEqual(pull());
  });

  const review = () => assertNotNull(view.review(pull().reviews[0]));
  it("review matches snapshot", () => {
    expect(review()).toMatchSnapshot();
  });
  it("review retrievable by address", () => {
    expect(view.review(review().address)).toEqual(review());
  });

  const comment = () => assertNotNull(view.comment(issue().comments[0]));
  it("comment matches snapshot", () => {
    expect(comment()).toMatchSnapshot();
  });
  it("comment retrievable by address", () => {
    expect(view.comment(comment().address)).toEqual(comment());
  });

  const userlike = () =>
    assertNotNull(view.userlike(assertNotNull(issue().nominalAuthor)));
  it("userlike matches snapshot", () => {
    expect(userlike()).toMatchSnapshot();
  });
  it("userlike retrievable by address", () => {
    expect(view.userlike(userlike().address)).toEqual(userlike());
  });
});
