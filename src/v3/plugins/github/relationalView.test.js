// @flow

import * as R from "./relationalView";

describe("plugins/github/relationalView", () => {
  const data = require("./demoData/example-github");
  // Sharing this state is OK because it's just a view - no mutation allowed!
  const view = new R.RelationalView(data);

  const repos = () => Array.from(view.repos());
  it("there is one repository", () => {
    expect(repos()).toHaveLength(1);
  });

  const repo = () => repos()[0];
  // Snapshotting the repo would snapshot all of the data,
  // which is somewhat excessive. Instead, we just check that
  // it has an expected number of issues and pulls.
  it("repo address matches snapshot", () => {
    expect(repo().address).toMatchSnapshot();
  });
  it("repo has issues", () => {
    expect(repo().issues.length).toMatchSnapshot();
  });
  it("repo has pulls", () => {
    expect(repo().issues.length).toMatchSnapshot();
  });
  it("repo retrievable by address", () => {
    expect(view.repo(repo().address)).toEqual(repo());
  });

  const issue = () => repo().issues[1];
  it("issues are retrievable", () => {
    expect(Array.from(view.issues())).toEqual(
      expect.arrayContaining([issue()])
    );
  });
  it("issue matches snapshot", () => {
    expect(issue()).toMatchSnapshot();
  });
  it("issue retrievable by address", () => {
    expect(view.issue(issue().address)).toEqual(issue());
  });

  const pull = () => repo().pulls[1];
  it("pulls are retrievable", () => {
    expect(Array.from(view.pulls())).toEqual(expect.arrayContaining([pull()]));
  });
  it("pull matches snapshot", () => {
    expect(pull()).toMatchSnapshot();
  });
  it("pull retrievable by address", () => {
    expect(view.pull(pull().address)).toEqual(pull());
  });

  const review = () => pull().reviews[0];
  it("reviews are retrievable", () => {
    expect(Array.from(view.reviews())).toEqual(
      expect.arrayContaining([review()])
    );
  });
  it("review matches snapshot", () => {
    expect(review()).toMatchSnapshot();
  });
  it("review retrievable by address", () => {
    expect(view.review(review().address)).toEqual(review());
  });

  const comment = () => issue().comments[0];
  it("comments are retrievable", () => {
    expect(Array.from(view.comments())).toEqual(
      expect.arrayContaining([comment()])
    );
  });
  it("comment matches snapshot", () => {
    expect(comment()).toMatchSnapshot();
  });
  it("comment retrievable by address", () => {
    expect(view.comment(comment().address)).toEqual(comment());
  });

  const userlike = () => issue().nominalAuthor;
  it("userlikes are retrievable", () => {
    expect(Array.from(view.userlikes())).toEqual(
      expect.arrayContaining([userlike()])
    );
  });
  it("userlike matches snapshot", () => {
    expect(userlike()).toMatchSnapshot();
  });
  it("userlike retrievable by address", () => {
    const u = userlike();
    if (u == null) {
      throw new Error(`Bad userlike for test case: ${String(u)}`);
    }
    expect(view.userlike(u.address)).toEqual(userlike());
  });
});
