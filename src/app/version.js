// @flow

export type VersionInfo = {|
  +major: number,
  +minor: number,
  +patch: number,
|};

export const VERSION_INFO = Object.freeze({
  major: 0,
  minor: 0,
  patch: 0,
});

export function format(info: VersionInfo): string {
  return `v${info.major}.${info.minor}.${info.patch}`;
}

export const VERSION = format(VERSION_INFO);
