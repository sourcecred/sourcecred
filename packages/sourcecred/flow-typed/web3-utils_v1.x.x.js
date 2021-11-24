// @flow

declare module 'web3-utils' {
  declare function isAddress(s: string): boolean;
  declare function toChecksumAddress(s: string): string;
  declare function soliditySha3(...args: any): string;
}
