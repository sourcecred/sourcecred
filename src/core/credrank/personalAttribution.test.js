// @flow
import * as uuid from "../../util/uuid";
import {
  validatePersonalAttributions,
  IndexedPersonalAttributions,
} from "./personalAttribution";

describe("core/credrank/personalAttribution", () => {
  let personalAttributions;
  const epochStarts = [0, 2, 4, 6];
  const id1 = uuid.fromString("YVZhbGlkVXVpZEF0TGFzdA");
  const id2 = uuid.fromString("URgLrCxgvjHxtGJ9PgmckQ");
  const id3 = uuid.fromString("EpbMqV0HmcolKvpXTwSddA");

  beforeEach(() => {
    personalAttributions = [
      {
        fromParticipantId: id1,
        recipients: [
          {
            toParticipantId: id2,
            proportions: [
              {timestampMs: 0, proportionValue: 0.2},
              {timestampMs: 3, proportionValue: 0.5},
              //These are non-arbitrary. They are needed to test edge cases:
              {timestampMs: 5, proportionValue: 1},
              {timestampMs: 5, proportionValue: 0},
            ],
          },
          {
            toParticipantId: id3,
            proportions: [
              {timestampMs: 1, proportionValue: 0.3},
              {timestampMs: 3, proportionValue: 0.5},
            ],
          },
        ],
      },
      {
        fromParticipantId: id2,
        recipients: [
          {
            toParticipantId: id3,
            proportions: [
              {timestampMs: 1, proportionValue: 0.3},
              {timestampMs: 5, proportionValue: 0.5},
            ],
          },
        ],
      },
    ];
  });

  describe("validatePersonalAttributions", () => {
    it("does not throw when the PersonalAttributions is valid", () => {
      expect(() => {
        validatePersonalAttributions(personalAttributions);
      }).not.toThrow();
      expect(() => {
        new IndexedPersonalAttributions(personalAttributions, epochStarts);
      }).not.toThrow();
    });

    it("throws when duplicate entries are found for a fromParticipantId pair", () => {
      personalAttributions[1].fromParticipantId =
        personalAttributions[0].fromParticipantId;
      expect(() => {
        validatePersonalAttributions(personalAttributions);
      }).toThrow("More than one PersonalAttribution object");
      expect(() => {
        new IndexedPersonalAttributions(personalAttributions, epochStarts);
      }).toThrow("More than one PersonalAttribution object");
    });

    it("throws when duplicate entries are found for a from-to participant pair", () => {
      personalAttributions[0].recipients[1].toParticipantId =
        personalAttributions[0].recipients[0].toParticipantId;
      expect(() => {
        validatePersonalAttributions(personalAttributions);
      }).toThrow("More than one AttributionRecipient object");
      expect(() => {
        new IndexedPersonalAttributions(personalAttributions, epochStarts);
      }).toThrow("More than one AttributionRecipient object");
    });

    it("throws when proportions are not in chronological order", () => {
      personalAttributions[0].recipients[0].proportions[0].timestampMs =
        personalAttributions[0].recipients[1].proportions[1].timestampMs + 1;
      expect(() => {
        validatePersonalAttributions(personalAttributions);
      }).toThrow("Personal Attribution proportions not in chronological order");
      expect(() => {
        new IndexedPersonalAttributions(personalAttributions, epochStarts);
      }).toThrow("Personal Attribution proportions not in chronological order");
    });

    it("throws when a proportion is less than 0", () => {
      personalAttributions[0].recipients[0].proportions[0].proportionValue = -0.1;
      expect(() => {
        validatePersonalAttributions(personalAttributions);
      }).toThrow("Personal Attribution proportion value must be between");
      expect(() => {
        new IndexedPersonalAttributions(personalAttributions, epochStarts);
      }).toThrow("Personal Attribution proportion value must be between");
    });

    it("throws when a proportion is greater than 1", () => {
      personalAttributions[0].recipients[0].proportions[0].proportionValue = 1.1;
      expect(() => {
        validatePersonalAttributions(personalAttributions);
      }).toThrow("Personal Attribution proportion value must be between");
      expect(() => {
        new IndexedPersonalAttributions(personalAttributions, epochStarts);
      }).toThrow("Personal Attribution proportion value must be between");
    });
  });

  describe("IndexedPersonalAttributions", () => {
    let index;

    beforeEach(() => {
      index = new IndexedPersonalAttributions(
        personalAttributions,
        epochStarts
      );
    });

    describe(".constructor", () => {
      it("throws when a participant attributes more than 100% of their cred in one epoch", () => {
        personalAttributions[0].recipients[0].proportions[0].proportionValue = 1;
        expect(() => {
          new IndexedPersonalAttributions(personalAttributions, epochStarts);
        }).toThrow("Sum of Personal Attributions for epoch");
      });
    });

    describe(".toPersonalAttributions", () => {
      it("returns a PersonalAttributions equivalent to the original PersonalAttributions", () => {
        expect(index.toPersonalAttributions()).toEqual(personalAttributions);
      });
    });

    describe(".recipientsForEpochAndParticipant", () => {
      it("returns the recipient list", () => {
        //when the proportion timestamp = epochStart
        expect(
          index.recipientsForEpochAndParticipant(epochStarts[0], id1)
        ).toEqual([id2]);
        //when the proportion timestamp < epochStart
        expect(
          index.recipientsForEpochAndParticipant(epochStarts[1], id1)
        ).toEqual([id2, id3]);
        expect(
          index.recipientsForEpochAndParticipant(epochStarts[1], id2)
        ).toEqual([id3]);
        //when newer proportion overwrites older proportion
        expect(
          index.recipientsForEpochAndParticipant(epochStarts[2], id1)
        ).toEqual([id2, id3]);
      });

      it("does not return recipients set to 0", () => {
        expect(
          index.recipientsForEpochAndParticipant(epochStarts[3], id1)
        ).toEqual([id3]);
      });

      it("does not return recipients that start after the epoch", () => {
        expect(
          index.recipientsForEpochAndParticipant(epochStarts[0], id2)
        ).toEqual([]);
      });

      it("does not return recipients when there are no recipients", () => {
        personalAttributions[0].recipients = [];
        index = new IndexedPersonalAttributions(
          personalAttributions,
          epochStarts
        );
        expect(
          index.recipientsForEpochAndParticipant(epochStarts[1], id1)
        ).toEqual([]);
      });
    });

    describe(".getProportionValue", () => {
      it("returns the correct proportion", () => {
        //when the proportion timestamp = epochStart
        expect(index.getProportionValue(epochStarts[0], id1, id2)).toEqual(0.2);
        //when the proportion timestamp < epochStart
        expect(index.getProportionValue(epochStarts[1], id2, id3)).toEqual(0.3);
        //when newer proportion overwrites older proportion
        expect(index.getProportionValue(epochStarts[3], id2, id3)).toEqual(0.5);
      });

      it("returns 0 when proportion set to 0", () => {
        expect(index.getProportionValue(epochStarts[3], id1, id2)).toEqual(0);
      });

      it("returns null when first proportion starts after the epoch", () => {
        expect(index.getProportionValue(epochStarts[0], id2, id3)).toEqual(
          null
        );
      });

      it("throws when the fromParticipantId is not found", () => {
        expect(() => {
          index.getProportionValue(
            epochStarts[1],
            uuid.fromString("UNKOWNlkVXVpZEF0TGFzdA"),
            id1
          );
        }).toThrow("Could not find PersonalAttribution");
      });

      it("throws when the recipient is not found", () => {
        expect(() => {
          index.getProportionValue(epochStarts[1], id2, id1);
        }).toThrow("Could not find AttributionRecipient");
      });
    });

    describe(".getSumProportionValue", () => {
      it("returns the correct proportion sums", () => {
        expect([
          index.getSumProportionValue(epochStarts[0], id1),
          index.getSumProportionValue(epochStarts[1], id1),
          index.getSumProportionValue(epochStarts[2], id1),
          index.getSumProportionValue(epochStarts[3], id1),
          index.getSumProportionValue(epochStarts[0], id2),
          index.getSumProportionValue(epochStarts[1], id2),
          index.getSumProportionValue(epochStarts[2], id2),
          index.getSumProportionValue(epochStarts[3], id2),
        ]).toEqual([0.2, 0.5, 1, 0.5, null, 0.3, 0.3, 0.5]);
      });

      it("returns null when the participant is not found", () => {
        expect(
          index.getSumProportionValue(
            epochStarts[1],
            uuid.fromString("UNKOWNlkVXVpZEF0TGFzdA")
          )
        ).toEqual(null);
      });
    });
  });
});
