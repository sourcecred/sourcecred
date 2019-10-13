// @flow

import deepFreeze from "deep-freeze";
import type {ObjectId} from "../../graphql/schema";

export const BLACKLISTED_IDS: $ReadOnlyArray<ObjectId> = deepFreeze([
  // These are `Organization` nodes that are sometimes referenced in a
  // `User` context: in particular, as the author of a reaction.
  // See: https://gist.github.com/wchargin/a2b8561b81bcc932c84e493d2485ea8a
  "MDEyOk9yZ2FuaXphdGlvbjE3OTUyOTI1",
  "MDEyOk9yZ2FuaXphdGlvbjI5MTkzOTQ=",
  "MDEyOk9yZ2FuaXphdGlvbjEyNDE3MDI0",
  "MDEyOk9yZ2FuaXphdGlvbjQzMDkzODIw",
  "MDEyOk9yZ2FuaXphdGlvbjEyNDk5MDI=", // techtribe
  "MDEyOk9yZ2FuaXphdGlvbjIxMzQ5NTM=", // nueko
  "MDEyOk9yZ2FuaXphdGlvbjQ0MDU2MDY4", // foodles-tech
  "MDEyOk9yZ2FuaXphdGlvbjQ2NzU5NjQ=", // webfluence
  "MDEyOk9yZ2FuaXphdGlvbjEyMzk1MTUy", // codekraft-studio
  "MDEyOk9yZ2FuaXphdGlvbjM1MTcyODE2", // nextbook
  "MDEyOk9yZ2FuaXphdGlvbjM0NzUxNTIz", // Xakher
  "MDEyOk9yZ2FuaXphdGlvbjE5NzczMjAy", // pelorushealth
  "MDEyOk9yZ2FuaXphdGlvbjE3NTQzMzM2", // MadeInMoon
  "MDEyOk9yZ2FuaXphdGlvbjUxODYwNTU=", // witbybit
  "MDEyOk9yZ2FuaXphdGlvbjE0ODg2MjM4", // BeSports
  "MDEyOk9yZ2FuaXphdGlvbjg5MTczMzY=", // coderhaoxin
  "MDEyOk9yZ2FuaXphdGlvbjk2MjQ0OTk=", // polimex
  "MDEyOk9yZ2FuaXphdGlvbjE5OTM5MTU2", // the-map
  "MDEyOk9yZ2FuaXphdGlvbjU3MTE1NTM=", // hybridinteractive
  "MDEyOk9yZ2FuaXphdGlvbjkzODAyMjA=", // thomasBla
  "MDEyOk9yZ2FuaXphdGlvbjI3MzYzMjM=", // difuse
  "MDEyOk9yZ2FuaXphdGlvbjI5MDkwMjk3", // neotech-development
  "MDEyOk9yZ2FuaXphdGlvbjE2MDk4MjE0", // vuejsdevelopers
  "MDEyOk9yZ2FuaXphdGlvbjE3OTk2MTA5", // fastcampusgit
  "MDEyOk9yZ2FuaXphdGlvbjMzMDU1Mzkx", // embod
  "MDEyOk9yZ2FuaXphdGlvbjEzNDcxNDMx", // NaumenkoYuliia
  "MDEyOk9yZ2FuaXphdGlvbjIwNTY5NDIz", // bimface
  "MDEyOk9yZ2FuaXphdGlvbjI0ODk0Mzk5", // xelmedia
  "MDEyOk9yZ2FuaXphdGlvbjkwNDUyMjA=", // fraserc
  "MDEyOk9yZ2FuaXphdGlvbjQ0NDkzNTY4", // atsolution
  "MDEyOk9yZ2FuaXphdGlvbjE4NDE5NzQ3", // nimat-netlinks
  "MDEyOk9yZ2FuaXphdGlvbjE3NTA3NDU=", // dogtownmedia
  "MDEyOk9yZ2FuaXphdGlvbjI2MjExNDIz", // Pursuittech
  "MDEyOk9yZ2FuaXphdGlvbjY1ODAyMzU=", // blooprint
  "MDEyOk9yZ2FuaXphdGlvbjM2MTU1MDkz", // ngosafety
  "MDEyOk9yZ2FuaXphdGlvbjQ5MjEwNjU=", // jornak
  "MDEyOk9yZ2FuaXphdGlvbjIyNzUwNTQw", // FringeAI
  "MDEyOk9yZ2FuaXphdGlvbjE0NDYzMTM=", // collibra
  "MDEyOk9yZ2FuaXphdGlvbjIyMTIwMzE1", // doctoome
  "MDEyOk9yZ2FuaXphdGlvbjMxNzEwMDc5", // theviji
  "MDEyOk9yZ2FuaXphdGlvbjI2NTQyODYw", // esc-co
  "MDEyOk9yZ2FuaXphdGlvbjEzMzcwNDk5", // Imerso3D
  "MDEyOk9yZ2FuaXphdGlvbjQ3MjYwMzI0", // wunbit

  // These are `Bot` nodes that are sometimes referenced in a `User`
  // context: in particular, as the author of a commit.
  "MDM6Qm90MjMwNDAwNzY=", // greenkeeper
  "MDM6Qm90NDk2OTkzMzM=", // dependabot
  "MDM6Qm90NDY0NDczMjE=", // allcontributors
  "MDM6Qm90MjkxMzk2MTQ=", // renovate
  "MDM6Qm90Mjk5NjY3OTc=", // eslint
  "MDM6Qm90Mjc4NTYyOTc=", // dependabot-preview
  "MDM6Qm90MzY3NzE0MDE=", // azure-pipelines

  // Problematic interactions they did as a user: reactions.
  "MDg6UmVhY3Rpb24yMTY3ODkyNQ==",
  "MDg6UmVhY3Rpb240NDMwMzQ1",
  "MDg6UmVhY3Rpb24xMDI4MzQxOA==",
  "MDg6UmVhY3Rpb24zNDUxNjA2MQ==",
  "MDg6UmVhY3Rpb24xNTUyODc3OQ==", // https://github.com/quasarframework/quasar/issues/1064
  "MDg6UmVhY3Rpb24xNjA5NDYyOQ==", // https://github.com/quasarframework/quasar/issues/1123#issuecomment-343846259
  "MDg6UmVhY3Rpb24xNjIxNTMzNQ==", // https://github.com/quasarframework/quasar/pull/1128#issuecomment-344605228
  "MDg6UmVhY3Rpb24xMjIxMTk2Ng==", //https://github.com/passbolt/passbolt_api/issues/19
  "MDg6UmVhY3Rpb24zMTg4NjU3NQ==", // https://github.com/prettier/prettier/issues/40
  "MDg6UmVhY3Rpb24xMzEzNjY5MA==", // https://github.com/prettier/prettier/issues/187
  "MDg6UmVhY3Rpb24xMzEzNjc2OQ==", // https://github.com/prettier/prettier/issues/187#issuecomment-318651633
  "MDg6UmVhY3Rpb24zMDI4MTA3NQ==", // https://github.com/prettier/prettier/issues/4959#issuecomment-417971638
  "MDg6UmVhY3Rpb241MjU4NTk3OQ==", // https://github.com/prettier/prettier/pull/6613#issuecomment-539072522
  "MDg6UmVhY3Rpb241MjY0MDU1MA==", // https://github.com/prettier/prettier/pull/6621#issuecomment-539364478
  "MDg6UmVhY3Rpb24xNTA0NDgwMw==", // https://github.com/lovell/sharp/issues/693#issuecomment-276087065
  "MDg6UmVhY3Rpb24xMDgwNTI3MA==", // https://github.com/facebook/jest/issues/1293
  "MDg6UmVhY3Rpb24yOTc4MTE3Mg==", // https://github.com/facebook/jest/issues/2441
  "MDg6UmVhY3Rpb24xNzk2NTE5MA==", // https://github.com/facebook/jest/issues/3254#issuecomment-297214395
  "MDg6UmVhY3Rpb24zMzkwMjY3Nw==", // https://github.com/facebook/jest/issues/3254#issuecomment-293188965
  "MDg6UmVhY3Rpb24zMzkwMjY3OQ==", // https://github.com/facebook/jest/issues/3254#issuecomment-293188965
  "MDg6UmVhY3Rpb24xNzk2NTE5Mg==", // https://github.com/facebook/jest/issues/3254#issuecomment-297214395
  "MDg6UmVhY3Rpb24xNzk2NTE5Mw==", // https://github.com/facebook/jest/issues/3254#issuecomment-297214395
  "MDg6UmVhY3Rpb24yMzU1Mjg1OQ==", // https://github.com/babel/babel-eslint/issues/6
  "MDg6UmVhY3Rpb244NTkyODUz", // https://github.com/recharts/recharts/issues/274#issuecomment-274824705
  "MDg6UmVhY3Rpb240NDk2OTA3", // https://github.com/webpack-contrib/css-loader/issues/38#issuecomment-152411328
  "MDg6UmVhY3Rpb241MjQ3Nzc2", // https://github.com/webpack-contrib/css-loader/issues/38#issuecomment-72287584
  "MDg6UmVhY3Rpb242MDg1MTIz", // https://github.com/webpack-contrib/css-loader/issues/145#issuecomment-240553884
  "MDg6UmVhY3Rpb24xODg5OTc5MQ==", // https://github.com/webpack-contrib/css-loader/issues/640#issuecomment-349993990
  "MDg6UmVhY3Rpb24xODUzNzYz", // https://github.com/yannickcr/eslint-plugin-react/issues/473#issuecomment-199787204
  "MDg6UmVhY3Rpb240NDY5ODc=", // https://github.com/vuejs/vuex/issues/139
  "MDg6UmVhY3Rpb24xNjk5MjEzNA==", // https://github.com/chimurai/http-proxy-middleware/issues/215
  "MDg6UmVhY3Rpb242NzQ1NzE3", // https://github.com/sass/node-sass/issues/1192#issuecomment-226215807
  "MDg6UmVhY3Rpb242MDY2NjQx", // https://github.com/sass/node-sass/issues/1527#issuecomment-217070514
  "MDg6UmVhY3Rpb24xMTE1ODMwOQ==", // https://github.com/sass/node-sass/issues/1579#issuecomment-227662011
  "MDg6UmVhY3Rpb24xMTE1ODMxMg==", // https://github.com/sass/node-sass/issues/1579#issuecomment-227662011
  "MDg6UmVhY3Rpb24xOTQ4NjE2MA==", // https://github.com/sass/node-sass/issues/2176#issuecomment-348673813
  "MDg6UmVhY3Rpb24xOTQ4NjE2Mw==", // https://github.com/sass/node-sass/issues/2176
  "MDg6UmVhY3Rpb245MDQzMTU3", // https://github.com/lodash/lodash/pull/942
  "MDg6UmVhY3Rpb24yNjc0OTYzNQ==", // https://github.com/vuejs/vue/issues/2164#issuecomment-259835750
  "MDg6UmVhY3Rpb243Njc5ODIw", // https://github.com/vuejs/vue/issues/4101#issuecomment-279121718
  "MDg6UmVhY3Rpb24yMjgyMDcyMQ==", // https://github.com/vuejs/vue/issues/4376#issuecomment-296125042
  "MDg6UmVhY3Rpb24xMzY0MTg5Ng==", // https://github.com/vuejs/vue/issues/4962#issuecomment-280779102
  "MDg6UmVhY3Rpb24yNjc0OTYyNA==", // https://github.com/vuejs/vue/issues/2164#issuecomment-274279029
  "MDg6UmVhY3Rpb245MDU0NzYx", // https://github.com/ReactTraining/react-router/issues/4410
  "MDg6UmVhY3Rpb24yNTA4NDAx", // https://github.com/ReactTraining/react-router/issues/676#issuecomment-197548633
  "MDg6UmVhY3Rpb24yMDE4NzIxNQ==", // https://github.com/ReactTraining/react-router/issues/1147#issuecomment-221880855
  "MDg6UmVhY3Rpb240MDQ0Mzg5", // https://github.com/ReactTraining/react-router/issues/1967#issuecomment-248420824
  "MDg6UmVhY3Rpb24yNjI5MjIyMg==", // https://github.com/ReactTraining/react-router/issues/3109#issuecomment-186998940
  "MDg6UmVhY3Rpb24yNjg3ODQwMA==", // https://github.com/ReactTraining/react-router/issues/3109#issuecomment-189782650
  "MDg6UmVhY3Rpb244ODk3NTU0", // https://github.com/ReactTraining/react-router/issues/3498#issuecomment-259543681
  "MDg6UmVhY3Rpb245MDU0NzYy", // https://github.com/ReactTraining/react-router/issues/4410
  "MDg6UmVhY3Rpb24xMDk1NzUxOQ==", // https://github.com/ReactTraining/react-router/issues/4467#issuecomment-281439695
  "MDg6UmVhY3Rpb24yNjg0OTU5", // https://github.com/axios/axios/issues/97#issuecomment-149153444
  "MDg6UmVhY3Rpb24zMTQ2ODAxMA==", // https://github.com/axios/axios/issues/1469
  "MDg6UmVhY3Rpb24xODI2MDE3MA==", // https://github.com/axios/axios/issues/960#issuecomment-309287911
  "MDg6UmVhY3Rpb241MjExNjEwNQ==", // https://github.com/sinonjs/sinon/pull/2096#issuecomment-536904272
  "MDg6UmVhY3Rpb241MjQ3ODM5NQ==", // https://github.com/sinonjs/sinon/pull/2116#issuecomment-538548018
  "MDg6UmVhY3Rpb241MDgyNTU3", // https://github.com/webpack/webpack-dev-server/issues/24#issuecomment-44366325
  "MDg6UmVhY3Rpb243ODQwOTgw", // https://github.com/webpack/webpack-dev-server/issues/400#issuecomment-201213206
  "MDg6UmVhY3Rpb24xNDk2NzExOA==", // https://github.com/webpack/webpack-dev-server/issues/533#issuecomment-296381317
  "MDg6UmVhY3Rpb24yNjg1ODMyOA==", // https://github.com/webpack/webpack-dev-server/issues/547#issuecomment-237963007
  "MDg6UmVhY3Rpb24xNjIxMDQ4Mw==", // https://github.com/webpack/webpack-dev-server/issues/547#issuecomment-284737321
  "MDg6UmVhY3Rpb24yNDAyNzczOA==", // https://github.com/webpack/webpack/issues/196#issuecomment-386411864
  "MDg6UmVhY3Rpb243MDA0MjQx", // https://github.com/webpack/webpack/issues/597#issuecomment-115922865
  "MDg6UmVhY3Rpb24xMTMwNTIwOQ==", // https://github.com/webpack/webpack/issues/2145#issuecomment-307743682
  "MDg6UmVhY3Rpb24xMDYwMTA2NA==", // https://github.com/webpack/webpack/issues/2704#issuecomment-228860162
  "MDg6UmVhY3Rpb24zOTg1MTQ5OA==", // https://github.com/webpack/webpack/issues/7197#issuecomment-387973628
  "MDg6UmVhY3Rpb24yMDEyODg1NQ==", // https://github.com/eslint/eslint/issues/9767#issuecomment-353840674
]);
