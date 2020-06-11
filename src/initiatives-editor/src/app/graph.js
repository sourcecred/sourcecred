// @flow
import {Graph} from "sourcecred/src/core/graph";
import {fromJSON} from "sourcecred/src/analysis/pluginDeclaration";

/*
export let graph;
export let plugins;
export let users = [];
export let activities = [];
export let project;
*/

export async function initGraph(
  apiProvider,
  setState: function
): Promise<void> {
  const {
    data: {graph: weightedGraphJSON},
  } = await apiProvider.getOne("graphs", {id: 0});
  const [, {graphJSON}] = JSON.parse(weightedGraphJSON);
  const graph = Graph.fromJSON(graphJSON); // return graph
  const plugins = await initPlugins(apiProvider);
  const activities = loadActivity(plugins, graph);
  const users = loadUsers(plugins, graph);
  const project = await loadProject(apiProvider);
  const loaded = graph && plugins && activities && users && project && true;
  setState({
    graph,
    plugins,
    users,
    activities,
    project,
    loaded,
  });
}

export async function loadProject(apiProvider): Promise<Object> {
  const {
    data: {project: serializedProjectJSON},
  } = await apiProvider.getOne("project", {id: 0});
  return JSON.parse(serializedProjectJSON);
}
export async function initPlugins(apiProvider): Promise<Object> {
  const {
    data: {plugins: serializedPluginsJSON},
  } = await apiProvider.getOne("plugins", {id: 0});
  const pluginsJSON = JSON.parse(serializedPluginsJSON);
  return fromJSON(pluginsJSON); // return plugins
}
export function loadActivity(plugins, graph): Array<Object> {
  const activityPrefixes = plugins.reduce((acc, {nodeTypes}) => {
    nodeTypes.forEach(
      (type) =>
        !["Bot", "User", "Identity", "Like"].find((n) => n === type.name) &&
        acc.push(type.prefix)
    );
    return acc;
  }, []);
  let activities = [];
  activityPrefixes.forEach((prefix) => {
    let activityIterator = graph.nodes({prefix});
    let nextActivity = activityIterator.next();
    while (!nextActivity.done) {
      let activity = {
        ...nextActivity.value,
      };
      activities.push(activity); // find a way to return activities here, possibly refactor
      nextActivity = activityIterator.next();
    }
  });
  return activities;
}
export function loadUsers(plugins, graph): Array<Object> {
  const userPrefixes = plugins.reduce((acc, {userTypes}) => {
    userTypes.forEach((type) => acc.push(type.prefix));
    return acc;
  }, []);
  let users = [];
  userPrefixes.forEach((prefix) => {
    let userIterator = graph.nodes({prefix});
    let nextUser = userIterator.next();
    while (!nextUser.done) {
      let user = {
        ...nextUser.value,
      };
      users.push(user); // find a way to return users, possibly refactor
      nextUser = userIterator.next();
    }
  });
  return users;
}
