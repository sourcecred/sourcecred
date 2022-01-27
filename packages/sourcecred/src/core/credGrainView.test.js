// @flow

import {CredGrainView} from "./credGrainView";
import * as GraphUtil from "./credrank/testUtils";
import {createTestLedgerFixture, createUuidMock, createDateMock} from "./ledger/testUtils";
import {g, nng} from "./ledger/testUtils";
import {Ledger} from "./ledger/ledger";
import * as uuid from "../util/uuid";

describe("core/credGrainView", () => {
  const dateMock = createDateMock();
  const {
    identity1,
    identity2,
    ledgerWithActiveIdentities,
  } = createTestLedgerFixture(createUuidMock(), dateMock);
  const allocationId1 = uuid.random();
  const allocationId2 = uuid.random();

  describe("when two identities have grain across two intervals", () => {
    let credGraph;
    let ledger;
    let credGrainView;
    const id1 = GraphUtil.participant1.id;
    const id2 = GraphUtil.participant2.id;
    const allocation1 = {
      policy: {
        policyType: "IMMEDIATE",
        budget: nng("10"),
        numIntervalsLookback: 1,
      },
      id: allocationId1,
      receipts: [
        {amount: g("3"), id: id1},
        {amount: g("7"), id: id2},
      ],
    };
    const allocation2 = {
      id: allocationId2,
      policy: {
        policyType: "BALANCED",
        budget: nng("20"),
        numIntervalsLookback: 0,
      },
      receipts: [
        {amount: g("10"), id: id1},
        {amount: g("10"), id: id2},
      ],
    };
    const distribution1 = {
      credTimestamp: GraphUtil.week1 + 1,
      allocations: [allocation1, allocation2],
      id: uuid.random(),
    };
    const distribution2 = {
      credTimestamp: GraphUtil.week2 + 1,
      allocations: [allocation2],
      id: uuid.random(),
    };

    beforeEach(async (done) => {
      credGraph = await GraphUtil.credGraph();
      ledger = ledgerWithActiveIdentities(id1, id2);
      ledger.distributeGrain(distribution1);
      ledger.distributeGrain(distribution2);
      credGrainView = CredGrainView.fromCredGraphAndLedger(credGraph, ledger);
      done();
    });

    it("does a JSON round trip", () => {
      expect(CredGrainView.fromJSON(credGrainView.toJSON())).toEqual(
        credGrainView
      );
    });

    it("should have participant data for all intervals", () => {
      const expectedIntervals = GraphUtil.intervals;
      const expectedParticipants = [
        {
          active: true,
          identity: identity1(id1),
          cred: GraphUtil.expectedParticipant1.cred,
          credPerInterval: GraphUtil.expectedParticipant1.credPerInterval,
          grainEarned: g("23"),
          grainEarnedPerInterval: [g("13"), g("10")],
        },
        {
          active: true,
          identity: identity2(id2),
          cred: GraphUtil.expectedParticipant2.cred,
          credPerInterval: GraphUtil.expectedParticipant2.credPerInterval,
          grainEarned: g("27"),
          grainEarnedPerInterval: [g("17"), g("10")],
        },
      ];

      expect(credGrainView.intervals()).toEqual(expectedIntervals);
      expect(credGrainView.participants()).toEqual(expectedParticipants);
    });

    it("should have correct aggregates", () => {
      expect(credGrainView.totalGrainPerInterval()).toEqual([g("30"), g("20")]);
      // cred is not easily tested because of expectedParticipant2's cred is
      // so small that it is lost to imprecision during addition.
    });

    describe("when time scoped to exactly the last interval", () => {
      it("should have participant and aggregate data for the last interval", () => {
        const timeScopedCredGrainView = credGrainView.withTimeScope(
          GraphUtil.intervals[GraphUtil.intervals.length - 1].startTimeMs,
          GraphUtil.intervals[GraphUtil.intervals.length - 1].endTimeMs
        );
        const expectedIntervals = [
          GraphUtil.intervals[GraphUtil.intervals.length - 1],
        ];
        const expectedParticipants = [
          {
            active: true,
            identity: identity1(id1),
            cred: GraphUtil.expectedParticipant1.credPerInterval[1],
            credPerInterval: [
              GraphUtil.expectedParticipant1.credPerInterval[1],
            ],
            grainEarned: g("10"),
            grainEarnedPerInterval: [g("10")],
          },
          {
            active: true,
            identity: identity2(id2),
            cred: GraphUtil.expectedParticipant2.credPerInterval[1],
            credPerInterval: [
              GraphUtil.expectedParticipant2.credPerInterval[1],
            ],
            grainEarned: g("10"),
            grainEarnedPerInterval: [g("10")],
          },
        ];

        expect(timeScopedCredGrainView.intervals()).toEqual(expectedIntervals);
        expect(timeScopedCredGrainView.participants()).toEqual(
          expectedParticipants
        );
        expect(timeScopedCredGrainView.totalGrainPerInterval()).toEqual([
          g("20"),
        ]);
      });
    });

    describe("when time scoped to exactly the first interval", () => {
      it("should have participant and aggregate data for the first interval", () => {
        const timeScopedCredGrainView = credGrainView.withTimeScope(
          GraphUtil.intervals[0].startTimeMs,
          GraphUtil.intervals[0].endTimeMs
        );
        const expectedIntervals = [GraphUtil.intervals[0]];
        const expectedParticipants = [
          {
            active: true,
            identity: identity1(id1),
            cred: GraphUtil.expectedParticipant1.credPerInterval[0],
            credPerInterval: [
              GraphUtil.expectedParticipant1.credPerInterval[0],
            ],
            grainEarned: g("13"),
            grainEarnedPerInterval: [g("13")],
          },
          {
            active: true,
            identity: identity2(id2),
            cred: GraphUtil.expectedParticipant2.credPerInterval[0],
            credPerInterval: [
              GraphUtil.expectedParticipant2.credPerInterval[0],
            ],
            grainEarned: g("17"),
            grainEarnedPerInterval: [g("17")],
          },
        ];

        expect(timeScopedCredGrainView.intervals()).toEqual(expectedIntervals);
        expect(timeScopedCredGrainView.participants()).toEqual(
          expectedParticipants
        );
        expect(timeScopedCredGrainView.totalGrainPerInterval()).toEqual([
          g("30"),
        ]);
      });
    });

    describe("when time scoped around the first interval", () => {
      it("should have participant data for the first interval", () => {
        const timeScopedCredGrainView = credGrainView.withTimeScope(
          GraphUtil.intervals[0].startTimeMs - 1,
          GraphUtil.intervals[0].endTimeMs + 1
        );
        const expectedIntervals = [GraphUtil.intervals[0]];
        const expectedParticipants = [
          {
            active: true,
            identity: identity1(id1),
            cred: GraphUtil.expectedParticipant1.credPerInterval[0],
            credPerInterval: [
              GraphUtil.expectedParticipant1.credPerInterval[0],
            ],
            grainEarned: g("13"),
            grainEarnedPerInterval: [g("13")],
          },
          {
            active: true,
            identity: identity2(id2),
            cred: GraphUtil.expectedParticipant2.credPerInterval[0],
            credPerInterval: [
              GraphUtil.expectedParticipant2.credPerInterval[0],
            ],
            grainEarned: g("17"),
            grainEarnedPerInterval: [g("17")],
          },
        ];

        expect(timeScopedCredGrainView.intervals()).toEqual(expectedIntervals);
        expect(timeScopedCredGrainView.participants()).toEqual(
          expectedParticipants
        );
      });
    });

    describe("when time scoped after all intervals", () => {
      it("should have participant data for no intervals", () => {
        const timeScopedCredGrainView = credGrainView.withTimeScope(
          9999,
          99999
        );
        const expectedIntervals = [];
        const expectedParticipants = [
          {
            active: true,
            identity: identity1(id1),
            cred: 0,
            credPerInterval: [],
            grainEarned: g("0"),
            grainEarnedPerInterval: [],
          },
          {
            active: true,
            identity: identity2(id2),
            cred: 0,
            credPerInterval: [],
            grainEarned: g("0"),
            grainEarnedPerInterval: [],
          },
        ];

        expect(timeScopedCredGrainView.intervals()).toEqual(expectedIntervals);
        expect(timeScopedCredGrainView.participants()).toEqual(
          expectedParticipants
        );
      });
    });

    describe("when time scoped for the partial beginning of an interval", () => {
      it("should have participant data for no intervals", () => {
        const timeScopedCredGrainView = credGrainView.withTimeScope(
          GraphUtil.intervals[0].startTimeMs,
          GraphUtil.intervals[0].startTimeMs + 1
        );
        const expectedIntervals = [];
        const expectedParticipants = [
          {
            active: true,
            identity: identity1(id1),
            cred: 0,
            credPerInterval: [],
            grainEarned: g("0"),
            grainEarnedPerInterval: [],
          },
          {
            active: true,
            identity: identity2(id2),
            cred: 0,
            credPerInterval: [],
            grainEarned: g("0"),
            grainEarnedPerInterval: [],
          },
        ];

        expect(timeScopedCredGrainView.intervals()).toEqual(expectedIntervals);
        expect(timeScopedCredGrainView.participants()).toEqual(
          expectedParticipants
        );
      });
    });

    describe("when time scoped for the partial end of an interval", () => {
      it("should have participant data for no intervals", () => {
        const timeScopedCredGrainView = credGrainView.withTimeScope(
          GraphUtil.intervals[0].startTimeMs + 1,
          GraphUtil.intervals[0].endTimeMs
        );
        const expectedIntervals = [];
        const expectedParticipants = [
          {
            active: true,
            identity: identity1(id1),
            cred: 0,
            credPerInterval: [],
            grainEarned: g("0"),
            grainEarnedPerInterval: [],
          },
          {
            active: true,
            identity: identity2(id2),
            cred: 0,
            credPerInterval: [],
            grainEarned: g("0"),
            grainEarnedPerInterval: [],
          },
        ];

        expect(timeScopedCredGrainView.intervals()).toEqual(expectedIntervals);
        expect(timeScopedCredGrainView.participants()).toEqual(
          expectedParticipants
        );
      });
    });
  });

  describe("when two identities have grain in only the first interval", () => {
    let credGraph;
    let ledger;
    let credGrainView;
    const id1 = GraphUtil.participant1.id;
    const id2 = GraphUtil.participant2.id;
    const allocation1 = {
      policy: {
        policyType: "IMMEDIATE",
        budget: nng("10"),
        numIntervalsLookback: 1,
      },
      id: allocationId1,
      receipts: [
        {amount: g("3"), id: id1},
        {amount: g("7"), id: id2},
      ],
    };
    const distribution1 = {
      credTimestamp: GraphUtil.week1 + 1,
      allocations: [allocation1],
      id: uuid.random(),
    };

    beforeEach(async (done) => {
      credGraph = await GraphUtil.credGraph();
      ledger = ledgerWithActiveIdentities(id1, id2);
      ledger.distributeGrain(distribution1);
      credGrainView = CredGrainView.fromCredGraphAndLedger(credGraph, ledger);
      done();
    });

    it("should have correct participant data for all intervals", () => {
      const expectedIntervals = GraphUtil.intervals;
      const expectedParticipants = [
        {
          active: true,
          identity: identity1(id1),
          cred: GraphUtil.expectedParticipant1.cred,
          credPerInterval: GraphUtil.expectedParticipant1.credPerInterval,
          grainEarned: g("3"),
          grainEarnedPerInterval: [g("3"), g("0")],
        },
        {
          active: true,
          identity: identity2(id2),
          cred: GraphUtil.expectedParticipant2.cred,
          credPerInterval: GraphUtil.expectedParticipant2.credPerInterval,
          grainEarned: g("7"),
          grainEarnedPerInterval: [g("7"), g("0")],
        },
      ];

      expect(credGrainView.intervals()).toEqual(expectedIntervals);
      expect(credGrainView.participants()).toEqual(expectedParticipants);
    });

    describe("when time scoped to exactly the last interval", () => {
      it("should have participant data for the last interval", () => {
        const timeScopedCredGrainView = credGrainView.withTimeScope(
          GraphUtil.intervals[GraphUtil.intervals.length - 1].startTimeMs,
          GraphUtil.intervals[GraphUtil.intervals.length - 1].endTimeMs
        );
        const expectedIntervals = [
          GraphUtil.intervals[GraphUtil.intervals.length - 1],
        ];
        const expectedParticipants = [
          {
            active: true,
            identity: identity1(id1),
            cred: GraphUtil.expectedParticipant1.credPerInterval[1],
            credPerInterval: [
              GraphUtil.expectedParticipant1.credPerInterval[1],
            ],
            grainEarned: g("0"),
            grainEarnedPerInterval: [g("0")],
          },
          {
            active: true,
            identity: identity2(id2),
            cred: GraphUtil.expectedParticipant2.credPerInterval[1],
            credPerInterval: [
              GraphUtil.expectedParticipant2.credPerInterval[1],
            ],
            grainEarned: g("0"),
            grainEarnedPerInterval: [g("0")],
          },
        ];

        expect(timeScopedCredGrainView.intervals()).toEqual(expectedIntervals);
        expect(timeScopedCredGrainView.participants()).toEqual(
          expectedParticipants
        );
      });
    });
  });

  describe("when two identities have no grain distribution", () => {
    let credGraph;
    let ledger;
    let credGrainView;
    const id1 = GraphUtil.participant1.id;
    const id2 = GraphUtil.participant2.id;

    beforeEach(async (done) => {
      credGraph = await GraphUtil.credGraph();
      ledger = ledgerWithActiveIdentities(id1, id2);
      credGrainView = CredGrainView.fromCredGraphAndLedger(credGraph, ledger);
      done();
    });

    it("should have correct participant data for all intervals", () => {
      const expectedIntervals = GraphUtil.intervals;
      const expectedParticipants = [
        {
          active: true,
          identity: identity1(id1),
          cred: GraphUtil.expectedParticipant1.cred,
          credPerInterval: GraphUtil.expectedParticipant1.credPerInterval,
          grainEarned: g("0"),
          grainEarnedPerInterval: [g("0"), g("0")],
        },
        {
          active: true,
          identity: identity2(id2),
          cred: GraphUtil.expectedParticipant2.cred,
          credPerInterval: GraphUtil.expectedParticipant2.credPerInterval,
          grainEarned: g("0"),
          grainEarnedPerInterval: [g("0"), g("0")],
        },
      ];

      expect(credGrainView.intervals()).toEqual(expectedIntervals);
      expect(credGrainView.participants()).toEqual(expectedParticipants);
    });
  });

  describe("when the graph has participants but the ledger has no accounts", () => {
    let credGraph;
    let ledger;
    let credGrainView;

    beforeEach(async (done) => {
      credGraph = await GraphUtil.credGraph();
      ledger = new Ledger();
      credGrainView = CredGrainView.fromCredGraphAndLedger(credGraph, ledger);
      done();
    });

    it("should have no CredGrainView participants", () => {
      const expectedIntervals = GraphUtil.intervals;
      const expectedParticipants = [];

      expect(credGrainView.intervals()).toEqual(expectedIntervals);
      expect(credGrainView.participants()).toEqual(expectedParticipants);
    });
  });

  describe("when the ledger has an account that the graph does not have", () => {
    let credGraph;
    let ledger;
    const id1 = GraphUtil.participant1.id;
    const id2 = GraphUtil.participant2.id;

    beforeEach(async (done) => {
      credGraph = await GraphUtil.credGraph();
      ledger = ledgerWithActiveIdentities(id1, id2);
      ledger.createIdentity("USER", "credless");
      done();
    });

    it("should throw", () => {
      expect(() =>
        CredGrainView.fromCredGraphAndLedger(credGraph, ledger)
      ).toThrow("The graph is missing account");
    });
  });

  describe("validation tests", () => {
    it("no cred", () => {
      const credGrainViewNoCred = () =>
        CredGrainView.fromJSON(
          JSON.parse(
            '{"participants":[{"active":true,"identity":{"id":"YVZhbGlkVXVpZEF0TGFzdA", "subtype":"USER",\
      "address":"N\\u0000sourcecred\\u0000core\\u0000IDENTITY\\u0000YVZhbGlkVXVpZEF0TGFzdA\\u0000",\
      "name":"steven","aliases":[]},"cred":0,"credPerInterval":[0,0],"grainEarned":"23",\
      "grainEarnedPerInterval":["13","10"]},{"active":true,"identity":{"id":"URgLrCxgvjHxtGJ9PgmckQ",\
      "subtype":"ORGANIZATION","address":"N\\u0000sourcecred\\u0000core\\u0000IDENTITY\\u0000URgLrCxgvjHxtGJ9PgmckQ\\u0000",\
      "name":"crystal-gems","aliases":[]},"cred":0,"credPerInterval":[0,0],"grainEarned":"27",\
      "grainEarnedPerInterval":["17","10"]}],"intervals":[{"startTimeMs":0,"endTimeMs":2},{"startTimeMs":2,"endTimeMs":4}]}'
          )
        ).validateForGrainAllocation();
      expect(credGrainViewNoCred).toThrow(
        "cred is zero. Make sure your plugins are configured correctly and remember to run 'yarn go' to calculate the cred scores."
      );
    });

    it("cred total mismatch", () => {
      const credGrainViewCredTotalMismatchedIntervals = () =>
        CredGrainView.fromJSON(
          JSON.parse(
            '{"participants":[{"active":true,"identity":{"id":"YVZhbGlkVXVpZEF0TGFzdA","subtype":"USER",\
      "address":"N\\u0000sourcecred\\u0000core\\u0000IDENTITY\\u0000YVZhbGlkVXVpZEF0TGFzdA\\u0000",\
      "name":"steven","aliases":[]},"cred":3,"credPerInterval":[0.9479471486739683,\
      2.0520521567464285],"grainEarned":"23","grainEarnedPerInterval":["13","10"]},{"active":true,\
      "identity":{"id":"URgLrCxgvjHxtGJ9PgmckQ","subtype":"ORGANIZATION",\
      "address":"N\\u0000sourcecred\\u0000core\\u0000IDENTITY\\u0000URgLrCxgvjHxtGJ9PgmckQ\\u0000",\
      "name":"crystal-gems","aliases":[]},"cred":1.286615549244117e-19,"credPerInterval":\
      [5.146462196976468e-20,7.719693295464702e-20],"grainEarned":"27","grainEarnedPerInterval":["17","10"]}],\
      "intervals":[{"startTimeMs":0,"endTimeMs":2},{"startTimeMs":2,"endTimeMs":4}]}'
          )
        );
      expect(credGrainViewCredTotalMismatchedIntervals).toThrow(
        "participant cred per interval sum [2.999999305420397] mismatched with participant cred total [3]"
      );
    });

    it("non numeric cred", () => {
      const credGrainViewNonNumericCred = () =>
        CredGrainView.fromJSON(
          JSON.parse(
            '{"participants":[{"active":true,"identity":{"id":"YVZhbGlkVXVpZEF0TGFzdA","subtype":"USER",\
      "address":"N\\u0000sourcecred\\u0000core\\u0000IDENTITY\\u0000YVZhbGlkVXVpZEF0TGFzdA\\u0000",\
      "name":"steven","aliases":[]},"cred":2.999999337965189,"credPerInterval":[0.9479471812187605,\
      2.0520521567464285],"grainEarned":"23","grainEarnedPerInterval":["13","10"]},{"active":true,\
      "identity":{"id":"URgLrCxgvjHxtGJ9PgmckQ","subtype":"ORGANIZATION","address":\
      "N\\u0000sourcecred\\u0000core\\u0000IDENTITY\\u0000URgLrCxgvjHxtGJ9PgmckQ\\u0000","name":"crystal-gems",\
      "aliases":[]},"cred":"foo","credPerInterval":[5.146462196976468e-20,7.719693295464702e-20],\
      "grainEarned":"27","grainEarnedPerInterval":["17","10"]}],"intervals":[{"startTimeMs":0,"endTimeMs":2},\
      {"startTimeMs":2,"endTimeMs":4}]}'
          )
        );
      expect(credGrainViewNonNumericCred).toThrow(
        "Non numeric cred value found"
      );
    });

    it("non numeric cred interval", () => {
      const credGrainViewNonNumericCredInterval = () =>
        CredGrainView.fromJSON(
          JSON.parse(
            '{"participants":[{"active":true,"identity":{"id":"YVZhbGlkVXVpZEF0TGFzdA","subtype":"USER",\
      "address":"N\\u0000sourcecred\\u0000core\\u0000IDENTITY\\u0000YVZhbGlkVXVpZEF0TGFzdA\\u0000",\
      "name":"steven","aliases":[]},"cred":2.999999337965189,"credPerInterval":[0.9479471812187605,\
      2.0520521567464285],"grainEarned":"23","grainEarnedPerInterval":["13","10"]},{"active":true,\
      "identity":{"id":"URgLrCxgvjHxtGJ9PgmckQ","subtype":"ORGANIZATION","address":\
      "N\\u0000sourcecred\\u0000core\\u0000IDENTITY\\u0000URgLrCxgvjHxtGJ9PgmckQ\\u0000","name":"crystal-gems",\
      "aliases":[]},"cred":"20","credPerInterval":["20","bar"],\
      "grainEarned":"27","grainEarnedPerInterval":["17","10"]}],"intervals":[{"startTimeMs":0,"endTimeMs":2},\
      {"startTimeMs":2,"endTimeMs":4}]}'
          )
        );
      expect(credGrainViewNonNumericCredInterval).toThrow(
        "Non numeric cred value found"
      );
    });

    it("cred interval length mismatch", () => {
      const credGrainViewCredIntervalsLengthMismatch = () =>
        CredGrainView.fromJSON(
          JSON.parse(
            '{"participants":[{"active":true,"identity":{"id":"YVZhbGlkVXVpZEF0TGFzdA","subtype":"USER",\
      "address":"N\\u0000sourcecred\\u0000core\\u0000IDENTITY\\u0000YVZhbGlkVXVpZEF0TGFzdA\\u0000",\
      "name":"steven","aliases":[]},"cred":2.999999305420397,"credPerInterval":[0.9479471812187605],\
      "grainEarned":"23","grainEarnedPerInterval":["13","10"]},{"active":true,"identity":\
      {"id":"URgLrCxgvjHxtGJ9PgmckQ","subtype":"ORGANIZATION","address":\
      "N\\u0000sourcecred\\u0000core\\u0000IDENTITY\\u0000URgLrCxgvjHxtGJ9PgmckQ\\u0000","name":\
      "crystal-gems","aliases":[]},"cred":1.286615549244117e-19,"credPerInterval":\
      [5.146462196976468e-20,7.719693295464702e-20],"grainEarned":"27","grainEarnedPerInterval":["17","10"]}],\
      "intervals":[{"startTimeMs":0,"endTimeMs":2},{"startTimeMs":2,"endTimeMs":4}]}'
          )
        );
      expect(credGrainViewCredIntervalsLengthMismatch).toThrow(
        "participant cred per interval length mismatch"
      );
    });

    it("grain interval length mismatch", () => {
      const credGrainViewGrainIntervalsLengthMismatch = () =>
        CredGrainView.fromJSON(
          JSON.parse(
            '{"participants":[{"active":true,"identity":{"id":"YVZhbGlkVXVpZEF0TGFzdA","subtype":"USER","address"\
      :"N\\u0000sourcecred\\u0000core\\u0000IDENTITY\\u0000YVZhbGlkVXVpZEF0TGFzdA\\u0000","name":"steven","aliases":[]}\
      ,"cred":2.999999337965189,"credPerInterval":[0.9479471812187605,2.0520521567464285],"grainEarned":"23",\
      "grainEarnedPerInterval":["13","10"]},{"active":true,"identity":{"id":"URgLrCxgvjHxtGJ9PgmckQ",\
      "subtype":"ORGANIZATION","address":"N\\u0000sourcecred\\u0000core\\u0000IDENTITY\\u0000URgLrCxgvjHxtGJ9PgmckQ\\u0000"\
      ,"name":"crystal-gems","aliases":[]},"cred":1.286615549244117e-19,"credPerInterval":\
      [5.146462196976468e-20,7.719693295464702e-20],"grainEarned":"27","grainEarnedPerInterval":["10"]}],\
      "intervals":[{"startTimeMs":0,"endTimeMs":2},{"startTimeMs":2,"endTimeMs":4}]}'
          )
        );
      expect(credGrainViewGrainIntervalsLengthMismatch).toThrow(
        "participant grain per interval length mismatch"
      );
    });

    it("grain total mismatch with grain intervals", () => {
      const credGrainViewGrainTotalMismatchWithIntervals = () =>
        CredGrainView.fromJSON(
          JSON.parse(
            '{"participants":[{"active":true,"identity":{"id":"YVZhbGlkVXVpZEF0TGFzdA","subtype":"USER","address"\
      :"N\\u0000sourcecred\\u0000core\\u0000IDENTITY\\u0000YVZhbGlkVXVpZEF0TGFzdA\\u0000","name":"steven","aliases":[]},\
      "cred":2.999999337965189,"credPerInterval":[0.9479471812187605,2.0520521567464285],"grainEarned":"23",\
      "grainEarnedPerInterval":["12","10"]},{"active":true,"identity":{"id":"URgLrCxgvjHxtGJ9PgmckQ",\
      "subtype":"ORGANIZATION","address":"N\\u0000sourcecred\\u0000core\\u0000IDENTITY\\u0000URgLrCxgvjHxtGJ9PgmckQ\\u0000",\
      "name":"crystal-gems","aliases":[]},"cred":1.286615549244117e-19,"credPerInterval":\
      [5.146462196976468e-20,7.719693295464702e-20],"grainEarned":"27","grainEarnedPerInterval":["17","10"]}],\
      "intervals":[{"startTimeMs":0,"endTimeMs":2},{"startTimeMs":2,"endTimeMs":4}]}'
          )
        );
      expect(credGrainViewGrainTotalMismatchWithIntervals).toThrow(
        "participant grain per interval [22] mismatched with participant grain total [23] for participant [steven]"
      );
    });

    it("grain non numeric", () => {
      expect(() =>
        CredGrainView.fromJSON(
          JSON.parse(
            '{"participants":[{"active":true,"identity":{"id":"YVZhbGlkVXVpZEF0TGFzdA","subtype":"USER",\
          "address":"N\\u0000sourcecred\\u0000core\\u0000IDENTITY\\u0000YVZhbGlkVXVpZEF0TGFzdA\\u0000",\
          "name":"steven","aliases":[]},"cred":2.999999305420397,"credPerInterval":[0.9479471812187605,2.0520521567464285],\
          "grainEarned":"23","grainEarnedPerInterval":["13","10"]},{"active":true,"identity":{"id":"URgLrCxgvjHxtGJ9PgmckQ",\
          "subtype":"ORGANIZATION","address":"N\\u0000sourcecred\\u0000core\\u0000IDENTITY\\u0000URgLrCxgvjHxtGJ9PgmckQ\\u0000",\
          "name":"crystal-gems","aliases":[]},"cred":1.286615549244117e-19,"credPerInterval":\
          [5.146462196976468e-20,7.719693295464702e-20],"grainEarned":"27","grainEarnedPerInterval":["17","bar"]}],\
          "intervals":[{"startTimeMs":0,"endTimeMs":2},{"startTimeMs":2,"endTimeMs":4}]}'
          )
        )
      ).toThrow("Invalid integer: bar");
    });

    it("negative grain", () => {
      const credGrainViewNegativeGrain = () =>
        CredGrainView.fromJSON(
          JSON.parse(
            '{"participants":[{"active":true,"identity":{"id":"YVZhbGlkVXVpZEF0TGFzdA","subtype":"USER",\
      "address":"N\\u0000sourcecred\\u0000core\\u0000IDENTITY\\u0000YVZhbGlkVXVpZEF0TGFzdA\\u0000",\
      "name":"steven","aliases":[]},"cred":2.999999337965189,"credPerInterval":[0.9479471812187605,2.0520521567464285],\
      "grainEarned":"23","grainEarnedPerInterval":["13","10"]},{"active":true,"identity":{"id":"URgLrCxgvjHxtGJ9PgmckQ",\
      "subtype":"ORGANIZATION","address":"N\\u0000sourcecred\\u0000core\\u0000IDENTITY\\u0000URgLrCxgvjHxtGJ9PgmckQ\\u0000",\
      "name":"crystal-gems","aliases":[]},"cred":1.286615549244117e-19,"credPerInterval":\
      [5.146462196976468e-20,7.719693295464702e-20],"grainEarned":"15","grainEarnedPerInterval":["17","-2"]}],\
      "intervals":[{"startTimeMs":0,"endTimeMs":2},{"startTimeMs":2,"endTimeMs":4}]}'
          )
        );
      expect(credGrainViewNegativeGrain).toThrow(
        "negative grain paid in interval data"
      );
    });

    it("negative cred", () => {
      const credGrainViewNegativeCred = () =>
        CredGrainView.fromJSON(
          JSON.parse(
            '{"participants":[{"active":true,"identity":{"id":"YVZhbGlkVXVpZEF0TGFzdA","subtype":"USER",\
      "address":"N\\u0000sourcecred\\u0000core\\u0000IDENTITY\\u0000YVZhbGlkVXVpZEF0TGFzdA\\u0000",\
      "name":"steven","aliases":[]},"cred":1.104104975527668,"credPerInterval":[-0.9479471812187605,2.0520521567464285],\
      "grainEarned":"23","grainEarnedPerInterval":["13","10"]},{"active":true,"identity":{"id":"URgLrCxgvjHxtGJ9PgmckQ",\
      "subtype":"ORGANIZATION","address":"N\\u0000sourcecred\\u0000core\\u0000IDENTITY\\u0000URgLrCxgvjHxtGJ9PgmckQ\\u0000",\
      "name":"crystal-gems","aliases":[]},"cred":1.286615549244117e-19,"credPerInterval":\
      [5.146462196976468e-20,7.719693295464702e-20],"grainEarned":"27","grainEarnedPerInterval":["17","10"]}],\
      "intervals":[{"startTimeMs":0,"endTimeMs":2},{"startTimeMs":2,"endTimeMs":4}]}'
          )
        );
      expect(credGrainViewNegativeCred).toThrow(
        "negative cred in interval data"
      );
    });
  });
});
