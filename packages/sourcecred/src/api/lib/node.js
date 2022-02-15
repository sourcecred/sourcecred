// @flow

import deepFreeze from "deep-freeze";
import cloneDeep from "lodash.clonedeep";
import base from "./base";
// `cloneDeep` and `any` help get around
// assignment constraints in both Flow and JS
const api: any = {...cloneDeep(base)};

// Extended exports for calling SourceCred code programmatically
// in a node environment. Both the structure and the contents of
// this API are experimental and subject to change.

import {LocalInstance} from "../../api/instance/localInstance";
api.instance.LocalInstance = LocalInstance;

import {getOriginWriteInstance} from "../../api/instance/writeInstance";
api.instance.getOriginWriteInstance = getOriginWriteInstance;

import {getGithubWriteInstance} from "../../api/instance/writeInstance";
api.instance.getGithubWriteInstance = getGithubWriteInstance;

import {GithubPlugin} from "../../plugins/github/plugin";
api.plugins.github.GithubPlugin = GithubPlugin;

import {DiscordPlugin} from "../../plugins/discord/plugin";
api.plugins.discord.DiscordPlugin = DiscordPlugin;

import {DiscoursePlugin} from "../../plugins/discourse/plugin";
api.plugins.discourse.DiscoursePlugin = DiscoursePlugin;

import {InitiativesPlugin} from "../../plugins/initiatives/plugin";
api.plugins.initiatives.InitiativesPlugin = InitiativesPlugin;

export default (deepFreeze(api): typeof api);
