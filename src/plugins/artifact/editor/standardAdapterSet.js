// @flow

import {AdapterSet} from "./adapterSet";
import githubPluginAdapter from "./adapters/githubPluginAdapter";

const adapterSet = new AdapterSet();
adapterSet.addAdapter(githubPluginAdapter);

export default adapterSet;
