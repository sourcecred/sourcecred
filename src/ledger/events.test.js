// @flow

import type {Event} from "./events";
import {type TimestampMs} from "../util/timestamp";

describe("ledger/events", () => {
  describe("Event", () => {
    it("should always have a type", () => {
      type HasType = {+type: string};
      (e: Event): HasType => e;
    });

    it("should always have a version", () => {
      type HasVersion = {+version: number};
      (e: Event): HasVersion => e;
    });

    it("should always have a timestamp", () => {
      type HasTimestamp = {+timestamp: TimestampMs};
      (e: Event): HasTimestamp => e;
    });
  });
});
