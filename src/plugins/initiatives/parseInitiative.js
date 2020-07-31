// @flow
import * as C from "../../util/combo";
import {compatibleParser} from "../../util/compat";
import {COMPAT_INFO, upgradeFrom010} from "./initiativeFile";
import type {
  InitiativeFile,
  InitiativeFileV010,
  InitiativeFileV020,
} from "./initiativeFile";
import {_validateUrl} from "./initiativesDirectory";
import {fromISO, toISO} from "../../util/timestamp";

const URLParser = C.fmap(C.string, _validateUrl);

const TimestampParser = C.fmap(C.string, (t) => toISO(fromISO(t)));

const CommonFields = {
  title: C.string,
  timestampIso: TimestampParser,
  weight: C.object({incomplete: C.number, complete: C.number}),
  completed: C.boolean,
};

const NodeEntryParser = C.object(
  {
    title: C.string,
    timestampIso: TimestampParser,
    // Conceputally should use URLParser, but we allow strings
    // as part of a hack fix to https://github.com/sourcecred/sourcecred/issues/1807
    contributors: C.array(C.string),
  },
  {
    key: C.string,
    weight: C.number,
  }
);

const EdgeSpecParser = C.object(
  {},
  {
    urls: C.array(URLParser),
    entries: C.array(NodeEntryParser),
  }
);

const Parse_020: C.Parser<InitiativeFileV020> = C.object(CommonFields, {
  contributions: EdgeSpecParser,
  dependencies: EdgeSpecParser,
  references: EdgeSpecParser,
  // Conceputally should use URLParser, but we allow strings
  // as part of a hack fix to https://github.com/sourcecred/sourcecred/issues/1807
  champions: C.array(C.string),
});

const Parse_010: C.Parser<InitiativeFileV010> = (() => {
  return C.object(CommonFields, {
    contributions: C.array(URLParser),
    dependencies: C.array(URLParser),
    references: C.array(URLParser),
    champions: C.array(URLParser),
  });
})();

export const parser: C.Parser<InitiativeFile> = compatibleParser(
  COMPAT_INFO.type,
  {
    "0.2.0": Parse_020,
    "0.1.0": C.fmap(Parse_010, upgradeFrom010),
  }
);
