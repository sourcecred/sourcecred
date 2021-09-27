// @flow

import type {WritableDataStorage} from "./index";
import {stringToRepoId} from "../../plugins/github/repoId";
import type {GithubToken} from "../../plugins/github/token";
import type {RepoId, RepoIdString} from "../../plugins/github/repoId";
import fetch from "cross-fetch";
import {decode as base64Decode} from "base-64";
import {Ledger} from "../ledger/ledger";
import {decode, encode} from "./textEncoding";

const GET_LEDGER_QUERY = `
query getLedger($owner: String!, $repo: String!, $expression:String!) {
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
  repo: RepoIdString,
  branch: string,
};

export class GithubStorage implements WritableDataStorage {
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
   * data/ledger.json
   * @param path data/ledger.json
   * @returns {Promise<Ledger>}
   */
  async get(path: string): Promise<Uint8Array> {
    const options = {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this._token}`,
      },
      body: JSON.stringify({
        query: GET_LEDGER_QUERY,
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

    const ledgerBlobRes = await fetch(
      `${this._getRepoEndpoint()}/git/blobs/${blobSha}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this._token}`,
        },
      }
    );

    const ledgerDataBase64 = await ledgerBlobRes.json();
    const rawLedger = base64Decode(ledgerDataBase64.content);
    return encode(rawLedger);
  }

  async set(path: string, ledger: Uint8Array, message?: string): Promise<void> {
    // get ledger from value
    const ledgerData = decode(ledger);

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

    // Create a new tree from the latest commit and update the ledger blob
    const uploadLedgerBlobResult = await fetch(
      `${this._getRepoEndpoint()}/git/trees`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this._token}`,
        },
        body: JSON.stringify({
          tree: [
            {
              content: ledgerData,
              type: "blob",
              path: path,
              mode: "100644", // see https://docs.github.com/en/rest/reference/git#create-a-tree
            },
          ],
          base_tree: baseCommit,
        }),
      }
    );

    const uploadLedgerBlobTree: CreateBlobRes = await uploadLedgerBlobResult.json();

    // Create a commit with the new tree on top of the target branch
    const commitLedgerResult = await fetch(
      `${this._getRepoEndpoint()}/git/commits`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this._token}`,
        },
        body: JSON.stringify({
          message: `Ledger Update${message ? `: ${message}` : ""}`,
          tree: uploadLedgerBlobTree.sha,
          parents: [baseCommit],
          author: {
            name: "credbot",
            email: "credbot@users.noreply.github.com",
          },
        }),
      }
    );
    const newLedgerCommit = await commitLedgerResult.json();

    // Update the target branch to point to the new commit
    await fetch(`${this._getRepoEndpoint()}/git/refs/heads/${this._branch}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${this._token}`,
      },
      body: JSON.stringify({
        sha: newLedgerCommit.sha,
      }),
    });
  }

  _getRepoEndpoint(): string {
    const {owner, name} = this._repoId;
    return `${GithubStorage.ENDPOINT}/repos/${owner}/${name}`;
  }
}
