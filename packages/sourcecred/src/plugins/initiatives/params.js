// @flow

/**
 * Options to add to Project spec.
 * Assumes we're loading an InitiativesDirectory. We're not including the local
 * path here, as this is environment dependent. It should be passed as an ENV
 * or CLI parameter instead.
 */
export type ProjectParameters = {|
  +remoteUrl: string,
|};
