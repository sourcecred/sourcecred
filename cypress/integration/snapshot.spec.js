// @flow

/*
I'm having issues obtaining the correct "chai" definition from flow libdefs without
a localized declaration. I'm thinking of removing the chai and mocha libdefs and
creating a straightup ".flow" file in the cypress folder that we can import from, for a
couple reasons:
1. Cypress utilizes mocha and chai "under the hood" without importing them. The packages are forked
    and modified, so the libdefs aren't technically valid
2. library conflicts: The mocha and chai apis collide and conflict with jest, and flow
    doesn't seem smart enough to resolve this. Since cypress has a very contained folder
    structure, I think creating a ".flow" file containing the definitions we want is the
    path of least resistance.
*/
declare var expect: {
  <T>(actual: T, message?: string): ExpectChain<T>,
  fail: ((message?: string) => void) &
    ((actual: any, expected: any, message?: string, operator?: string) => void),
  ...
};

function getSnapShotOnLoad(route: string) {
  cy.visit(route).then(() => {
    // this step ensures the frontend has loaded
    // before taking a snapshot
    cy.get('[href="#/explorer"]');
    // $FlowIgnore[prop-missing]
    cy.document().toMatchImageSnapshot();
  });
}

context("Snapshots", () => {
  it("renders the Explorer view", () => {
    getSnapShotOnLoad("explorer");
  });
  it("renders the grain accounts view", () => {
    getSnapShotOnLoad("accounts");
  });
  it("renders the ledger history view", () => {
    getSnapShotOnLoad("ledger");
  });
  it("renders the Admin view", () => {
    getSnapShotOnLoad("admin");
  });
  it("renders the transfer view", () => {
    getSnapShotOnLoad("transfer");
  });
});
