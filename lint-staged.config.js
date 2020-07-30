// @flow
module.exports = {
  "{src,config}/**/*.js": "eslint --fix --max-warnings 0",
  "*.{js,css,md}": "prettier --write",
  "*.js": () => "flow",
};
