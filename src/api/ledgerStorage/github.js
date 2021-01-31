// @flow
import fetch from "cross-fetch";
import {decode as base64Decode} from "base-64";

import {Ledger} from "../../core/ledger/ledger";
import type {GithubToken} from "../../plugins/github/token";
import {
  type RepoIdString,
  type RepoId,
  stringToRepoId,
} from "../../plugins/github/repoId";
import type {LedgerStorage} from "../ledgerManager";

const GET_LEDGER_QUERY = `
query getLedger($owner:String!, $repo:String!) {
  repository(owner: $owner, name: $repo) {
    object(expression: "master:data/ledger.json") {
      ... on Blob {
        oid
      }
    }
  }
}
`;

export class GithubStorage implements LedgerStorage {
  constructor(apiToken: GithubToken, repoId: RepoIdString) {
    this._token = apiToken;
    this._repoId = stringToRepoId(repoId);
  }
  _token: GithubToken;
  _repoId: RepoId;

  async read(): Promise<Ledger> {
    const opts = {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this._token}`,
      },
      body: JSON.stringify({
        query: GET_LEDGER_QUERY,
        variables: {
          owner: this._repoId.owner,
          repo: this._repoId.name,
        },
      }),
    };

    const res = await fetch(`https://api.github.com/graphql`, opts);

    const {data} = await res.json();
    const blobSha = data.repository.object.oid;

    const ledgerBlobRes = await fetch(
      `https://api.github.com/repos/${this._repoId.owner}/${this._repoId.name}/git/blobs/${blobSha}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this._token}`,
        },
      }
    );
    const ledgerDataBase64 = await ledgerBlobRes.json();

    const rawLedger = base64Decode(ledgerDataBase64.content);

    return Ledger.parse(rawLedger);
  }

  async write() {
    throw new Error("method not implemented");
  }
}
