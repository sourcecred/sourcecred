// @flow

const presets = [
  [
    "@babel/preset-env",
    {
      targets: {
        edge: "17",
        firefox: "60",
        chrome: "67",
        safari: "11.1",
        node: true,
      },
    },
  ],
  "@babel/preset-react",
  "@babel/preset-flow",
];

const plugins = [
  "@babel/plugin-proposal-class-properties",
  "@babel/plugin-syntax-bigint",
];

module.exports = {presets, plugins};
