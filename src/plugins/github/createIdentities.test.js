// @flow

import {exampleEntities, exampleRelationalView} from "./example/example";
import {toRaw, type UserlikeAddress} from "./nodes";
import {_createIdentity, createIdentities} from "./createIdentities";

describe("plugins/github/createIdentities", () => {
  describe("_createIdentity", () => {
    it("sets the fields correctly in a simple case", () => {
      const {userlike} = exampleEntities();
      const expectedAlias = {
        description: userlike.description(),
        address: toRaw(userlike.address()),
      };
      expect(_createIdentity(userlike)).toEqual({
        type: "USER",
        pluginName: "github",
        name: userlike.login(),
        alias: expectedAlias,
      });
    });
    it("coerces the name if needed", () => {
      const {userlike} = exampleEntities();
      // $FlowExpectedError[cannot-write]
      userlike.login = () => "coerce?me";
      const identity = _createIdentity(userlike);
      expect(identity.name).toEqual("coerce-me");
    });
    it("sets the type to BOT for bots", () => {
      const {userlike} = exampleEntities();
      const address = userlike.address();
      const fakeAddress: UserlikeAddress = {
        ...address,
        subtype: "BOT",
      };
      // $FlowExpectedError[cannot-write]
      userlike.address = () => fakeAddress;
      const identity = _createIdentity(userlike);
      expect(identity.type).toEqual("BOT");
    });
  });
  describe("createIdentities", () => {
    it("maps over the users in the RelationalView", () => {
      const rv = exampleRelationalView();
      const expected = Array.from(rv.userlikes()).map(_createIdentity);
      const actual = createIdentities(rv);
      expect(expected).toEqual(actual);
    });
  });
});
