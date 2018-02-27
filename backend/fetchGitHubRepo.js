/*
 * API to scrape data from a GitHub repo using the GitHub API. See the
 * docstring of the default export for more details.
 */

const octokitFactory = require("@octokit/rest");

/**
 * Scrape data from a GitHub repo using the GitHub API.
 *
 * @param {String} repoOwner
 *    the GitHub username of the owner of the repository to be scraped
 * @param {String} repoName
 *    the name of the repository to be scraped
 * @param {String?} token
 *    optional authentication token to be used for the GitHub API (used
 *    to get around rate limits); generate a token at:
 *    https://github.com/settings/tokens
 * @return {Promise<object>}
 *    a promise that resolves to a JSON object containing the data
 *    scraped from the repository, with the following keys and data from
 *    the corresponding GitHub v3 endpoints:
 *      - issues: `/repos/:owner/:repo/issues`
 *      - pullRequests: `/repos/:owner/:repo/pulls`
 *      - issueComments: `/repos/:owner/:repo/issues/comments`
 *      - pullRequestComments: `/repos/:owner/:repo/pulls/comments`
 *      - pullRequestReviews: `/repos/:owner/:repo/pulls/:pull/reviews`,
 *        but concatenated over `:pull` so that the result is an array
 *        of objects
 */
module.exports = function fetchGitHubRepo(repoOwner, repoName, token) {
  const authOptions = token ? {type: "token", token} : null;
  return new Fetcher(repoOwner, repoName, authOptions).fetchAll();
};

class Fetcher {
  constructor(repoOwner, repoName, authOptions = undefined) {
    this._repoOwner = repoOwner;
    this._repoName = repoName;
    this._octokit = octokitFactory(octokitFactory);
    if (authOptions) {
      this._octokit.authenticate(authOptions);
    }
  }

  // Adapted from:
  // https://www.npmjs.com/package/@octokit/rest#pagination
  async paginate(promise) {
    let response = await promise;
    let {data} = response;
    while (this._octokit.hasNextPage(response)) {
      response = await this._octokit.getNextPage(response);
      data = [...data, ...response.data];
    }
    return data;
  }

  async fetchAll() {
    const pullRequests = await this.fetchPullRequests();
    return {
      issues: await this.fetchIssues(),
      pullRequests,
      issueComments: await this.fetchIssueComments(),
      pullRequestComments: await this.fetchPullRequestComments(),
      pullRequestReviews: await this.fetchPullRequestReviews(pullRequests),
    };
  }

  fetchPullRequests() {
    return this.paginate(
      this._octokit.pullRequests.getAll({
        owner: this._repoOwner,
        repo: this._repoName,
        state: "all",
        per_page: 100,
      })
    );
  }

  fetchIssues() {
    return this.paginate(
      this._octokit.issues.getForRepo({
        owner: this._repoOwner,
        repo: this._repoName,
        state: "all",
        per_page: 100,
      })
    );
  }

  fetchPullRequestComments() {
    return this.paginate(
      this._octokit.pullRequests.getCommentsForRepo({
        owner: this._repoOwner,
        repo: this._repoName,
        per_page: 100,
      })
    );
  }

  fetchIssueComments() {
    return this.paginate(
      this._octokit.issues.getCommentsForRepo({
        owner: this._repoOwner,
        repo: this._repoName,
        per_page: 100,
      })
    );
  }

  fetchIndividualPullRequestReviews(number) {
    return this.paginate(
      this._octokit.pullRequests.getReviews({
        owner: this._repoOwner,
        repo: this._repoName,
        number: number,
        per_page: 100,
      })
    );
  }

  fetchPullRequestReviews(allPullRequests) {
    const reviewses = Promise.all(
      allPullRequests.map((pr) =>
        this.fetchIndividualPullRequestReviews(pr.number)
      )
    );
    return reviewses.then((xss) => [].concat(...xss));
  }
}
