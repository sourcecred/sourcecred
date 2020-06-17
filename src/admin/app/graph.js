// @flow
import {Graph} from "../../core/graph";
import {fromJSON} from "../../analysis/pluginDeclaration";

export const localAddress = "http://localhost:3005";

export async function initGraph(setState: function): Promise<void> {
  const res = await fetch(`${localAddress}/graph`);
  const [, {graphJSON}] = await res.json();
  const graph = Graph.fromJSON(graphJSON); // return graph
  const plugins = await initPlugins();
  const activities = loadActivity(plugins, graph);
  const users = loadUsers(plugins, graph);
  const project = await loadProject();
  const loaded = graph && plugins && activities && users && project && true;
  setState(() => ({
    graph,
    plugins,
    users,
    activities,
    project,
    loaded,
  }));
}

export async function loadProject(): Promise<Object> {
  const res = await fetch(`${localAddress}/project`);
  const [, project] = await res.json();
  return project;
}
export async function initPlugins(): Promise<Object> {
  const res = await fetch(`${localAddress}/plugins`);
  const [, plugins] = await res.json();
  return plugins;
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
  const activities = [];
  activityPrefixes.forEach((prefix) => {
    const activityIterator = graph.nodes({prefix});
    let nextActivity = activityIterator.next();
    while (!nextActivity.done) {
      const activity = {
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
  const users = [];
  userPrefixes.forEach((prefix) => {
    const userIterator = graph.nodes({prefix});
    let nextUser = userIterator.next();
    while (!nextUser.done) {
      const user = {
        ...nextUser.value,
      };
      users.push(user); // find a way to return users, possibly refactor
      nextUser = userIterator.next();
    }
  });
  return users;
}
