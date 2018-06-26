// @flow

import * as E from "./entityStore";
import * as A from "./addressify";

function entityStore() {
  const data = require("./demoData/example-github");
  const addressed = A.addressify(data);
  return new E.EntityStore(addressed);
}

function checkEntities<T: E.Entity>(
  name: string,
  getAll: () => Iterator<T>,
  get: (a: any) => ?T
) {
  describe(name, () => {
    const xs = Array.from(getAll());
    const x = xs[0];
    it("entities match snapshot", () => {
      expect(x).toMatchSnapshot();
    });
    it("number of entities matches snapshot", () => {
      expect(xs.length).toMatchSnapshot();
    });
    it("entities retrievable by address", () => {
      expect(get(x.address)).toEqual(x);
    });
  });
}

describe("plugins/github/entityStore", () => {
  checkEntities(
    "repos",
    () => entityStore().repos(),
    (a) => entityStore().repo(a)
  );
  checkEntities(
    "issues",
    () => entityStore().issues(),
    (a) => entityStore().issue(a)
  );
  checkEntities(
    "pulls",
    () => entityStore().pulls(),
    (a) => entityStore().pull(a)
  );
  checkEntities(
    "reviews",
    () => entityStore().reviews(),
    (a) => entityStore().review(a)
  );
  checkEntities(
    "comments",
    () => entityStore().comments(),
    (a) => entityStore().comment(a)
  );
  checkEntities(
    "userlikes",
    () => entityStore().userlikes(),
    (a) => entityStore().userlike(a)
  );
});
