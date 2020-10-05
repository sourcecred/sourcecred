// @flow

import type {TimestampMs} from "../../util/timestamp";

export const formatTimestamp = (
  timestamp: TimestampMs | number,
  opts?: Intl$DateTimeFormatOptions
): string =>
  new Date(timestamp).toLocaleString("en", {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    year: "2-digit",
    ...opts,
  });
