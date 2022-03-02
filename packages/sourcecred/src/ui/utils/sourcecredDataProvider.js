// @flow

import {DataProvider} from "ra-core";
import {rawParser as rawInstanceConfigParser} from "../../api/rawInstanceConfig";
import {WritableGithubStorage} from "../../core/storage/github";
import {createPostableStorage} from "../../core/storage/originStorage";
import type {DataStorage} from "../../core/storage";
import {encode} from "../../core/storage/textEncoding";
import {loadJson, loadJsonWithDefault} from "../../util/storage";

const getStorage = async () => {
  const apiToken = prompt("Enter your github API key:");
  if (!apiToken)
    throw new Error("Must provide a github API key to view this page.");
  const repo = prompt("Enter your repository (example: sourcecred/cred):");
  if (!repo) throw new Error("Must provide a repository to view this page.");
  const branch = prompt("Enter your repository (example: sourcecred/cred):");
  if (!branch) throw new Error("Must provide a branch to view this page.");
  return new WritableGithubStorage({
    apiToken,
    repo,
    branch,
  });
};

const getOneRawInstanceConfig = async (params, storage) => {
  const rawInstanceConfig = {
    "id": 1,
    ...(await loadJson(storage, "sourcecred.json", rawInstanceConfigParser)),
  };
  const formatted = {
    ...rawInstanceConfig,
    credEquatePlugins: rawInstanceConfig.credEquatePlugins.map((plugin) => ({
      ...plugin,
      configsByTarget: Object.keys(plugin.configsByTarget).map((target) => ({
        target,
        configs: plugin.configsByTarget[target],
      })),
    })),
  };
  return {data: formatted};
};

const updateRawInstanceConfig = async (params, storage) => {
  const unformatted = {
    ...params.data,
    credEquatePlugins: params.data.credEquatePlugins.map((plugin) => ({
      ...plugin,
      configsByTarget: plugin.configsByTarget.reduce(
        (configsByTarget, {target, configs}) => {
          configsByTarget[target] = configs;
          return configsByTarget;
        },
        {}
      ),
    })),
  };
  const parsed = rawInstanceConfigParser.parseOrThrow(unformatted);

  await storage.set("sourcecred.json", encode(JSON.stringify(parsed)));
  return {data: {id: 1}};
};

export default (hasBackend: boolean): any => {
  const _obj = {id: 1};
  let storage = hasBackend ? createPostableStorage(".") : null;
  return {
    getList: (resource, params) => Promise.resolve({data: [_obj], total: 1}),
    getOne: async (resource, params) => {
      if (!storage) storage = await getStorage();
      switch (resource) {
        case "RawInstanceConfig":
          return getOneRawInstanceConfig(params, storage);
      }
    },
    getMany: (resource, params) => Promise.resolve({data: [_obj]}),
    getManyReference: (resource, params) =>
      Promise.resolve({data: [_obj], total: 1}),
    create: (resource, params) => Promise.resolve({data: _obj}),
    update: async (resource, params) => {
      if (!storage) storage = await getStorage();
      switch (resource) {
        case "RawInstanceConfig":
          return updateRawInstanceConfig(params, storage);
      }
    },
    updateMany: (resource, params) => Promise.resolve({data: [1]}),
    delete: (resource, params) => Promise.resolve({data: _obj}),
    deleteMany: (resource, params) => Promise.resolve({data: [1]}),
  };
};
