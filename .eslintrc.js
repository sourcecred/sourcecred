// @flow
module.exports = {
  parser: "babel-eslint",
  plugins: ["flowtype"],
  extends: "react-app",
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
  },
};
