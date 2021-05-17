// @flow

import {id1, id2, createTestLedgerFixture} from "../../core/ledger/testUtils";
import * as uuid from "../../util/uuid";
import {validateTimestampISO, fromISO} from "../../util/timestamp";
import {
  updatePersonalAttributionsConfig,
  personalAttributionsConfigParser as parser,
  toPersonalAttributions,
} from "./personalAttributionsConfig";

const {ledgerWithIdentities, identity1, identity2} = createTestLedgerFixture();

describe("api/config/personalAttributionsConfig", () => {
  describe("updatePersonalAttributionsConfig", () => {
    it("should add the ids when there are no ids", () => {
      const ledger = ledgerWithIdentities();
      const config = parser.parseOrThrow([
        {
          "fromParticipantName": identity1().name,
          "recipients": [
            {
              "toParticipantName": identity2().name,
              "proportions": [
                {
                  "startDate": "2/15/21",
                  "decimalProportion": 0.2222,
                },
              ],
            },
          ],
        },
      ]);
      const expected = [
        {
          "fromParticipantName": identity1().name,
          "fromParticipantId": id1,
          "recipients": [
            {
              "toParticipantName": identity2().name,
              "toParticipantId": id2,
              "proportions": [
                {
                  "startDate": validateTimestampISO("2/15/21"),
                  "decimalProportion": 0.2222,
                },
              ],
            },
          ],
        },
      ];

      expect(updatePersonalAttributionsConfig(config, ledger)).toEqual(
        expected
      );
    });

    it("should work when there are ids", () => {
      const ledger = ledgerWithIdentities();
      const config = parser.parseOrThrow([
        {
          "fromParticipantName": identity1().name,
          "fromParticipantId": id1,
          "recipients": [
            {
              "toParticipantName": identity2().name,
              "toParticipantId": id2,
              "proportions": [
                {
                  "startDate": "2/15/21",
                  "decimalProportion": 0.2222,
                },
              ],
            },
          ],
        },
      ]);
      const expected = [
        {
          "fromParticipantName": identity1().name,
          "fromParticipantId": id1,
          "recipients": [
            {
              "toParticipantName": identity2().name,
              "toParticipantId": id2,
              "proportions": [
                {
                  "startDate": validateTimestampISO("2/15/21"),
                  "decimalProportion": 0.2222,
                },
              ],
            },
          ],
        },
      ];

      expect(updatePersonalAttributionsConfig(config, ledger)).toEqual(
        expected
      );
    });

    it("should throw if a bad id is used", () => {
      const ledger = ledgerWithIdentities();
      const config = parser.parseOrThrow([
        {
          "fromParticipantName": identity1().name,
          "fromParticipantId": uuid.random(),
          "recipients": [
            {
              "toParticipantName": identity2().name,
              "toParticipantId": id2,
              "proportions": [
                {
                  "startDate": "2/15/21",
                  "decimalProportion": 0.2222,
                },
              ],
            },
          ],
        },
      ]);

      expect(() => updatePersonalAttributionsConfig(config, ledger)).toThrow(
        "no Account for identity"
      );
    });

    it("should throw if a bad name is used", () => {
      const ledger = ledgerWithIdentities();
      const config = parser.parseOrThrow([
        {
          "fromParticipantName": "badName",
          "recipients": [
            {
              "toParticipantName": identity2().name,
              "proportions": [
                {
                  "startDate": "2/15/21",
                  "decimalProportion": 0.2222,
                },
              ],
            },
          ],
        },
      ]);

      expect(() => updatePersonalAttributionsConfig(config, ledger)).toThrow(
        "does not exist"
      );
    });

    it("should update the names and ids when a merge has occured", () => {
      const ledger = ledgerWithIdentities();
      ledger.mergeIdentities({base: id1, target: id2});
      const config = parser.parseOrThrow([
        {
          "fromParticipantName": identity1().name,
          "fromParticipantId": id1,
          "recipients": [
            {
              "toParticipantName": identity2().name,
              "toParticipantId": id2,
              "proportions": [
                {
                  "startDate": "2/15/21",
                  "decimalProportion": 0.2222,
                },
              ],
            },
          ],
        },
      ]);
      const expected = [
        {
          "fromParticipantName": identity1().name,
          "fromParticipantId": id1,
          "recipients": [
            {
              "toParticipantName": identity1().name,
              "toParticipantId": id1,
              "proportions": [
                {
                  "startDate": validateTimestampISO("2/15/21"),
                  "decimalProportion": 0.2222,
                },
              ],
            },
          ],
        },
      ];

      expect(updatePersonalAttributionsConfig(config, ledger)).toEqual(
        expected
      );
    });
  });
  describe("toPersonalAttributions", () => {
    it("works", () => {
      const config = parser.parseOrThrow([
        {
          "fromParticipantName": identity1().name,
          "fromParticipantId": id1,
          "recipients": [
            {
              "toParticipantName": identity2().name,
              "toParticipantId": id2,
              "proportions": [
                {
                  "startDate": "2/15/21",
                  "decimalProportion": 0.2222,
                },
              ],
            },
          ],
        },
      ]);
      const expected = [
        {
          "fromParticipantId": id1,
          "recipients": [
            {
              "toParticipantId": id2,
              "proportions": [
                {
                  "timestampMs": fromISO("2/15/21"),
                  "proportionValue": 0.2222,
                },
              ],
            },
          ],
        },
      ];
      expect(toPersonalAttributions(config)).toEqual(expected);
    });
  });
});
