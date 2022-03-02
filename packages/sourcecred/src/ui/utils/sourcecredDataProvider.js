// @flow

import {rawParser as rawInstanceConfigParser} from "../../api/instanceConfig";
import {WritableGithubStorage} from "../../core/storage/github";
import {createPostableStorage} from "../../core/storage/originStorage";
import {encode} from "../../core/storage/textEncoding";
import {loadJson} from "../../util/storage";

const getStorage = async (hasBackend: boolean) => {
  if (hasBackend) return createPostableStorage(".");
  const apiToken = prompt(
    "You are entering an experimental feature that may be buggy. We recommend using Chrome.\nEnter your github API key:"
  );
  if (!apiToken)
    throw new Error("Must provide a github API key to view this page.");

  const repo = prompt("Enter your repository (example: sourcecred/cred):");
  if (!repo) throw new Error("Must provide a repository to view this page.");

  const branch = prompt("Enter an existing branch name (example: main):");
  if (!branch) throw new Error("Must provide a branch to view this page.");

  return new WritableGithubStorage({
    apiToken,
    repo,
    branch,
    message: "Changes made in Config Editor UI",
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
  let storage = null;
  return {
    getList: () => Promise.resolve({data: [_obj], total: 1}),
    getOne: async (resource, params) => {
      if (!storage) storage = await getStorage(hasBackend);
      switch (resource) {
        case "RawInstanceConfig":
          return getOneRawInstanceConfig(params, storage);
      }
    },
    getMany: () => Promise.resolve({data: [_obj]}),
    getManyReference: () => Promise.resolve({data: [_obj], total: 1}),
    create: () => Promise.resolve({data: _obj}),
    update: async (resource, params) => {
      if (!storage) storage = await getStorage(hasBackend);
      switch (resource) {
        case "RawInstanceConfig":
          return updateRawInstanceConfig(params, storage);
      }
    },
    updateMany: () => Promise.resolve({data: [1]}),
    delete: () => Promise.resolve({data: _obj}),
    deleteMany: () => Promise.resolve({data: [1]}),
  };
};
