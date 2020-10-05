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

context("Transfer Grain", () => {
  before(() => {
    cy.visit("http://localhost:8080/#/transfer");
  });
  it("can transfer grain", () => {
    // this kind of query is brittle, since it depends on the greater dom structure
    // Cypress suggests utilizing custom attributes (or props in MaterialUI)
    // to allow for less interdependent and thus less brittle query logic:
    // https://docs.cypress.io/guides/references/best-practices.html#Selecting-Elements
    cy.get(".MuiContainer-root > :nth-child(2) > :nth-child(1)").click().end();
    cy.contains("dandelion").click();
    // less-good assertion syntax (stringified operators are weird in my opinion)
    cy.get(".makeStyles-arrowBody-32 > span").should("contain", "max: 955.23g");
    cy.get(
      ".makeStyles-arrowBody-32 > .MuiFormControl-root > .MuiInputBase-root > .MuiInputBase-input"
    )
      .click()
      .type("50");
    cy.get(".MuiContainer-root > :nth-child(2) > :nth-child(3)").click();
    cy.contains("william").click();
    cy.get(
      ":nth-child(3) > .MuiFormControl-root > .MuiInputBase-root > .MuiInputBase-input"
    ).type("one, two, buckle my shoe");
    cy.contains("transfer grain").click();
    cy.get(".makeStyles-arrowBody-32 > span").should(($span) => {
      // better assertion syntax
      expect($span).to.contain("max: 905.23g");
    });
  });
});
