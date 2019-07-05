// @flow
module.exports = {
  parser: "babel-eslint",
  plugins: ["flowtype", "react"],
  env: {
    browser: true,
    es6: true,
    node: true,
    jest: true,
  },
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:flowtype/recommended",
  ],
  rules: {
    "no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_$|^_unused_",
        varsIgnorePattern: "^_$|^_unused_",
        caughtErrorsIgnorePattern: "^_$|^_unused_",
      },
    ],
    "no-use-before-define": ["off"],
    "no-useless-constructor": ["off"],
    "no-case-declarations": ["off"],
    "react/prop-types": ["off"],
    "flowtype/generic-spacing": ["off"],
    "flowtype/space-after-type-colon": ["off"],
  },
  settings: {
    react: {
      version: "detect",
    },
  },
};
