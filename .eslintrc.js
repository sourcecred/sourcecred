module.exports = {
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
  },
};
