// @flow

const Provider = require("@truffle/hdwallet-provider");

/*::
type Config = {|
  mnemonic: string,
  providerOrUrl: string,
  chainId?: string
|};
*/

function getProvider(config /*: Config*/) {
  console.log(config);
  console.log(Provider);
}

module.exports = getProvider;
