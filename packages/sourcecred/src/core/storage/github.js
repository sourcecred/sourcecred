// @flow

import type {DataStorage, WritableDataStorage} from "./index";
import {stringToRepoId} from "../../plugins/github/repoId";
import type {GithubToken} from "../../plugins/github/token";
import type {RepoId} from "../../plugins/github/repoId";
import fetch from "cross-fetch";
import {decode as base64Decode} from "base-64";
import {encode} from "./textEncoding";
import {toBase64} from "@aws-sdk/util-base64-browser";

// content keyword for matching GitHub's API terminology.
const GET_CONTENT_QUERY = `
query getContent($owner: String!, $repo: String!, $expression:String!) {
  repository(owner: $owner, name: $repo) {
    object(expression: $expression) {
      ... on Blob {
        oid
      }
    }
  }
}
`;

type CreateBlobRes = {
  sha: string,
  url: string,
};

type Opts = {
  apiToken: GithubToken,
  repo: string,
  branch: string,
};

type Author = {
  name: string,
  email: string,
};

export class GithubStorage implements DataStorage {
  static ENDPOINT: string = "https://api.github.com";

  constructor(opts: Opts) {
    this._token = opts.apiToken;
    this._repoId = stringToRepoId(opts.repo);
    this._branch = opts.branch;
  }

  _token: GithubToken;
  _repoId: RepoId;
  _branch: string;

  /**
   * get method loads the content specified by path in the GitHub repository.
   *
   * @param path relative path to the content.
   * @returns {Promise<Uint8Array>}
   */
  async get(path: string): Promise<Uint8Array> {
    const options = {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this._token}`,
      },
      body: JSON.stringify({
        query: GET_CONTENT_QUERY,
        variables: {
          owner: this._repoId.owner,
          repo: this._repoId.name,
          expression: `${this._branch}:${path}`,
        },
      }),
    };

    const result = await fetch(`${GithubStorage.ENDPOINT}/graphql`, options);

    const {data} = await result.json();
    const blobSha = data.repository.object.oid;

    const contentBlobRes = await fetch(
      `${this._getRepoEndpoint()}/git/blobs/${blobSha}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this._token}`,
        },
      }
    );

    const contentDataBase64 = await contentBlobRes.json();
    const rawContent = base64Decode(contentDataBase64.content);
    return encode(rawContent);
  }

  _getRepoEndpoint(): string {
    const {owner, name} = this._repoId;
    return `${GithubStorage.ENDPOINT}/repos/${owner}/${name}`;
  }
}

export class WritableGithubStorage
  extends GithubStorage
  implements WritableDataStorage {
  async set(
    path: string,
    content: Uint8Array,
    message?: string,
    author?: Author
  ): Promise<void> {
    // Get latest commit hash of target branch
    const targetBranchResult = await fetch(
      `${this._getRepoEndpoint()}/git/ref/heads/${this._branch}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this._token}`,
        },
      }
    );

    const targetBranchData = await targetBranchResult.json();
    const baseCommit = targetBranchData.object.sha;

    // Create new blob from the new content.
    const createBlobResult = await fetch(
      `${this._getRepoEndpoint()}/git/blobs`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this._token}`,
        },
        body: JSON.stringify({
          owner: this._repoId.owner,
          repo: this._repoId.name,
          content: toBase64(content),
          encoding: "base64",
        }),
      }
    );

    const createBlobData = await createBlobResult.json();
    const createBlobSha = createBlobData.sha;

    // Create a new tree from the latest commit and update the content blob
    const uploadBlobResult = await fetch(
      `${this._getRepoEndpoint()}/git/trees`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this._token}`,
        },
        body: JSON.stringify({
          tree: [
            {
              sha: createBlobSha,
              type: "blob",
              path: path,
              mode: "100644", // see https://docs.github.com/en/rest/reference/git#create-a-tree
            },
          ],
          base_tree: baseCommit,
        }),
      }
    );

    const uploadContentBlobTree: CreateBlobRes = await uploadBlobResult.json();

    // Create a commit with the new tree on top of the target branch
    const commitContentResult = await fetch(
      `${this._getRepoEndpoint()}/git/commits`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this._token}`,
        },
        body: JSON.stringify({
          message: message ?? "",
          tree: uploadContentBlobTree.sha,
          parents: [baseCommit],
          author: author ?? {
            name: "credbot",
            email: "credbot@users.noreply.github.com",
          },
        }),
      }
    );
    const newCommit = await commitContentResult.json();

    // Update the target branch to point to the new commit
    await fetch(`${this._getRepoEndpoint()}/git/refs/heads/${this._branch}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${this._token}`,
      },
      body: JSON.stringify({
        sha: newCommit.sha,
      }),
    });
  }
}
