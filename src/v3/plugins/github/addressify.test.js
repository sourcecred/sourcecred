// @flow

import * as A from "./addressify";
import * as Q from "./graphql";

function addressedData() {
  const data: Q.GithubResponseJSON = require("./demoData/example-github");
  return A.addressify(data);
}

describe("plugins/github/addressify", () => {
  const repos = () => addressedData().repos;
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

  const issue = () => repo().issues[1];
  it("issue matches snapshot", () => {
    expect(issue()).toMatchSnapshot();
  });

  const pull = () => repo().pulls[1];
  it("pull matches snapshot", () => {
    expect(pull()).toMatchSnapshot();
  });

  const review = () => pull().reviews[0];
  it("review matches snapshot", () => {
    expect(review()).toMatchSnapshot();
  });

  const comment = () => issue().comments[0];
  it("comment matches snapshot", () => {
    expect(comment()).toMatchSnapshot();
  });

  const userlike = () => issue().nominalAuthor;
  it("userlike matches snapshot", () => {
    expect(userlike()).toMatchSnapshot();
  });
});
