// @flow

import {Ledger} from "../core/ledger/ledger";
import {toDependencyPolicy, ensureIdentityExists} from "./dependenciesConfig";
import {nameFromString as n} from "../core/identity";
import {random as randomUuid} from "../util/uuid";
import {fromISO, toISO, validateTimestampISO} from "../util/timestamp";

describe("api/dependenciesConfig", () => {
  describe("ensureIdentityExists", () => {
    it("no-ops if the identity is already in the ledger", () => {
      const ledger = new Ledger();
      const id = ledger.createIdentity("PROJECT", "foo");
      const config = {
        id,
        name: n("foo"),
        autoActivateOnIdentityCreation: true,
        periods: [],
      };
      const events = ledger.eventLog();
      const config_ = ensureIdentityExists(config, ledger);
      expect(config).toEqual(config_);
      // No modification to the Ledger.
      expect(ledger.eventLog()).toEqual(events);
    });
    it("assigns an id to the config if an identity by that name was in the ledger", () => {
      const ledger = new Ledger();
      // Note: this ID is of a user, not a project; no problem.
      const id = ledger.createIdentity("USER", "foo");
      const config = {name: n("foo"), periods: []};
      const events = ledger.eventLog();
      const config_ = ensureIdentityExists(config, ledger);
      expect(config_.id).toEqual(id);
      // No modification to the periods
      expect(config_.periods).toEqual(config.periods);
      // No modification to the Ledger.
      expect(ledger.eventLog()).toEqual(events);
    });
    it("assigns an id and creates identity", () => {
      const ledger = new Ledger();
      const config = {name: n("foo"), periods: []};
      const {id, periods} = ensureIdentityExists(config, ledger);
      if (id == null) {
        // Will never happen in practice, but needed to appease Flow
        throw new Error("invariant violation");
      }
      const account = ledger.account(id);
      expect(account.identity.name).toEqual(config.name);
      expect(account.identity.subtype).toEqual("PROJECT");
      expect(account.active).toBe(false);
      expect(periods).toHaveLength(0);
    });
    it("can inject default period with weight", () => {
      const ledger = new Ledger();
      const autoInjectStartingPeriodWeight = 0.05;
      const fakeNow = Date.now();

      jest
        .spyOn(global.Date, "now")
        .mockImplementationOnce(() => fakeNow)
        .mockImplementationOnce(() => fakeNow);

      const config = {
        name: n("foo"),
        periods: [],
        autoInjectStartingPeriodWeight,
      };
      const {periods} = ensureIdentityExists(config, ledger);
      expect(periods).toHaveLength(1);
      expect(periods[0].weight).toBe(autoInjectStartingPeriodWeight);
      expect(fromISO(periods[0].startTime)).toBe(fakeNow);
    });
    it("does not inject default period if any period already exists", () => {
      const ledger = new Ledger();
      const config = {
        name: n("foo"),
        periods: [{startTime: toISO(1), weight: 0.05}],
        autoInjectStartingPeriodWeight: 0.01,
      };
      const {periods} = ensureIdentityExists(config, ledger);
      expect(periods).toEqual(config.periods);
    });

    it("does not inject default period if autoInjectStartingPeriodWeight is unset", () => {
      const ledger = new Ledger();
      const config = {
        name: n("foo"),
        periods: [],
      };
      const {periods} = ensureIdentityExists(config, ledger);
      expect(periods).toEqual(config.periods);
    });

    it("can activate newly-created identities", () => {
      const ledger = new Ledger();
      const config = {
        name: n("foo"),
        periods: [],
        autoActivateOnIdentityCreation: true,
      };
      const {id, periods} = ensureIdentityExists(config, ledger);
      if (id == null) {
        // Will never happen in practice, but needed to appease Flow
        throw new Error("invariant violation");
      }
      const account = ledger.account(id);
      expect(account.identity.name).toEqual(config.name);
      expect(account.identity.subtype).toEqual("PROJECT");
      expect(account.active).toBe(true);
      expect(periods).toHaveLength(0);
    });
    it("does not activate new identities if autoActivateOnIdentityCreation is unset", () => {
      const ledger = new Ledger();
      const config = {
        name: n("foo"),
        periods: [],
      };
      const {id, periods} = ensureIdentityExists(config, ledger);
      if (id == null) {
        // Will never happen in practice, but needed to appease Flow
        throw new Error("invariant violation");
      }
      const account = ledger.account(id);
      expect(account.active).toBe(false);
      expect(periods).toHaveLength(0);
    });
    it("does not activate new identities if autoActivateOnIdentityCreation is set to false", () => {
      const ledger = new Ledger();
      const config = {
        name: n("foo"),
        periods: [],
        autoActivateOnIdentityCreation: false,
      };
      const {id} = ensureIdentityExists(config, ledger);
      if (id == null) {
        // Will never happen in practice, but needed to appease Flow
        throw new Error("invariant violation");
      }
      const account = ledger.account(id);
      expect(account.active).toBe(false);
    });
    it("does not activate if the identity already exists (specified by id)", () => {
      const ledger = new Ledger();
      const id = ledger.createIdentity("USER", "foo");
      const config = {
        id,
        name: n("foo"),
        periods: [],
        autoActivateOnIdentityCreation: true,
      };
      ensureIdentityExists(config, ledger);
      const account = ledger.account(id);
      expect(account.active).toBe(false);
    });
    it("does not activate if the identity already exists (specified by name)", () => {
      const ledger = new Ledger();
      const id = ledger.createIdentity("USER", "foo");
      const config = {
        name: n("foo"),
        periods: [],
        autoActivateOnIdentityCreation: true,
      };
      ensureIdentityExists(config, ledger);
      const account = ledger.account(id);
      expect(account.active).toBe(false);
    });
    it("errors if the name in the config doesn't match name in the ledger", () => {
      const ledger = new Ledger();
      const id = ledger.createIdentity("USER", "foo");
      const config = {id, name: n("bar"), periods: []};
      const thunk = () => ensureIdentityExists(config, ledger);
      expect(thunk).toThrowError("dependency name discrepancy");
    });
  });

  describe("toDependencyPolicy", () => {
    it("creates a policy with the right address", () => {
      const ledger = new Ledger();
      const id = ledger.createIdentity("USER", "foo");
      const address = ledger.account(id).identity.address;
      const config = ensureIdentityExists(
        {name: n("foo"), periods: []},
        ledger
      );
      const policy = toDependencyPolicy(config, ledger);
      expect(policy.address).toEqual(address);
    });
    it("creates a policy with the right id", () => {
      const ledger = new Ledger();
      const id = ledger.createIdentity("USER", "foo");
      const config = ensureIdentityExists(
        {name: n("foo"), periods: []},
        ledger
      );
      const policy = toDependencyPolicy(config, ledger);
      expect(policy.id).toEqual(id);
    });
    it("creates a policy with specified periods", () => {
      const ledger = new Ledger();
      ledger.createIdentity("USER", "foo");
      const timestampISO = validateTimestampISO("2020-09-09");
      const timestampMs = fromISO(timestampISO);
      const config = ensureIdentityExists(
        {
          name: n("foo"),
          periods: [{startTime: timestampISO, weight: 0.1}],
        },
        ledger
      );
      const policy = toDependencyPolicy(config, ledger);
      expect(policy.periods).toEqual([{startTimeMs: timestampMs, weight: 0.1}]);
    });
    it("creates a policy with empty periods", () => {
      const ledger = new Ledger();
      ledger.createIdentity("USER", "foo");
      const config = ensureIdentityExists(
        {
          name: n("foo"),
          periods: [],
        },
        ledger
      );
      const policy = toDependencyPolicy(config, ledger);
      expect(policy.periods).toEqual([]);
    });
    it("errors if the config is missing an id", () => {
      const config = {name: n("foo"), periods: []};
      const ledger = new Ledger();
      const thunk = () => toDependencyPolicy(config, ledger);
      expect(thunk).toThrowError(
        "cannot convert config to policy before it has an id"
      );
    });
    it("errors if the id is not in the ledger", () => {
      const id = randomUuid();
      const config = {id, name: n("foo"), periods: []};
      const ledger = new Ledger();
      const thunk = () => toDependencyPolicy(config, ledger);
      expect(thunk).toThrowError("no Account for identity");
    });
  });
});
