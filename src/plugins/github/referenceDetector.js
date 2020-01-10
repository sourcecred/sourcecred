// @flow

import Database from "better-sqlite3";
import dedent from "../../util/dedent";

import {MappedReferenceDetector, type URL} from "../../core/references";
import {type NodeAddressT, NodeAddress} from "../../core/graph";
import {RelationalView} from "./relationalView";
import {Prefix} from "./nodes";
import {
  reviewUrlToId,
  issueCommentUrlToId,
  pullCommentUrlToId,
  reviewCommentUrlToId,
} from "./urlIdParse";
import * as Schema from "../../graphql/schema";
import {botSet as makeBotSet} from "./bots";

export function fromRelationalView(
  view: RelationalView
): GithubReferenceDetector {
  return new GithubReferenceDetector(view.urlReferenceMap());
}

export const GithubReferenceDetector = MappedReferenceDetector;

type InfixMap = Map<Schema.ObjectId, string[]>;
type ParentObjectMap = Map<Schema.ObjectId, [string, Schema.ObjectId]>;

export function referenceMapFromDB(
  db: Database,
  owner: string
): Map<URL, NodeAddressT> {
  const botSet = makeBotSet();
  const final: Map<URL, NodeAddressT> = new Map();
  const childToParent: ParentObjectMap = new Map();
  const infixes: InfixMap = new Map();

  const getParentInfixType = (
    id: Schema.ObjectId
  ): [string[], Schema.ObjectId] => {
    const parent = childToParent.get(id);
    if (!parent) throw new Error(`No parent for Object ${id}`);
    const parentInfix = infixes.get(parent[1]);
    if (!parentInfix) throw new Error(`No parentInfix for Object ${id}`);
    return [parentInfix, parent[0]];
  };

  const addConnections = (
    id: Schema.ObjectId,
    typename: string,
    fields: string[]
  ) => {
    const connections = findConnections(db, id, fields);
    for (const {child, parent} of connections) {
      childToParent.set(child, [typename, parent]);
    }
  };

  const users = findTypeProperties(db, "User", ["url", "login"]);
  for (const id in users) {
    const user = users[id];
    const prefix = botSet.has(user.login) ? Prefix.bot : Prefix.user;
    final.set(user.url, NodeAddress.append(prefix, user.login));
  }

  const bots = findTypeProperties(db, "Bot", ["url", "login"]);
  for (const id in bots) {
    const bot = bots[id];
    const prefix = botSet.has(bot.login) ? Prefix.bot : Prefix.user;
    final.set(bot.url, NodeAddress.append(prefix, bot.login));
  }

  const commits = findTypeProperties(db, "Commit", ["url"]);
  for (const id in commits) {
    const commit = commits[id];
    final.set(commit.url, NodeAddress.append(Prefix.commit, id));
  }

  const repos = findTypeProperties(db, "Repository", ["url", "name"]);
  for (const id in repos) {
    addConnections(id, "Repository", ["issues", "pullRequests"]);
    const repo = repos[id];
    const infix = [owner, repo.name];
    infixes.set(id, infix);
    final.set(repo.url, NodeAddress.append(Prefix.repo, ...infix));
  }

  const issues = findTypeProperties(db, "Issue", ["url", "number"]);
  for (const id in issues) {
    addConnections(id, "Issue", ["comments"]);
    const issue = issues[id];
    const [parentInfix] = getParentInfixType(id);
    const infix = [...parentInfix, issue.number.toString()];
    infixes.set(id, infix);
    final.set(issue.url, NodeAddress.append(Prefix.issue, ...infix));
  }

  const pulls = findTypeProperties(db, "PullRequest", ["url", "number"]);
  for (const id in pulls) {
    addConnections(id, "PullRequest", ["comments", "reviews"]);
    const pull = pulls[id];
    const [parentInfix] = getParentInfixType(id);
    const infix = [...parentInfix, pull.number.toString()];
    infixes.set(id, infix);
    final.set(pull.url, NodeAddress.append(Prefix.pull, ...infix));
  }

  const reviews = findTypeProperties(db, "PullRequestReview", ["url"]);
  for (const id in reviews) {
    addConnections(id, "PullRequestReview", ["comments"]);
    const review = reviews[id];
    const [parentInfix] = getParentInfixType(id);
    const number = reviewUrlToId(review.url);
    const infix = [...parentInfix, number.toString()];
    infixes.set(id, infix);
    final.set(review.url, NodeAddress.append(Prefix.review, ...infix));
  }

  const issueComments = findTypeProperties(db, "IssueComment", ["url"]);
  for (const id in issueComments) {
    const comment = issueComments[id];
    const [parentInfix, parentType] = getParentInfixType(id);
    const number = getCommentNumber(comment.url, parentType);
    const prefix = getCommentPrefix(parentType);
    const infix = [...parentInfix, number.toString()];
    infixes.set(id, infix);
    final.set(comment.url, NodeAddress.append(prefix, ...infix));
  }

  const reviewComments = findTypeProperties(db, "PullRequestReviewComment", [
    "url",
  ]);
  for (const id in reviewComments) {
    const comment = reviewComments[id];
    const [parentInfix, parentType] = getParentInfixType(id);
    const number = getCommentNumber(comment.url, parentType);
    const prefix = getCommentPrefix(parentType);
    const infix = [...parentInfix, number.toString()];
    infixes.set(id, infix);
    final.set(comment.url, NodeAddress.append(prefix, ...infix));
  }

  return final;
}

function getCommentNumber(url: string, parentType: string): string {
  switch (parentType) {
    case "Issue":
      return issueCommentUrlToId(url);
    case "PullRequest":
      return pullCommentUrlToId(url);
    case "PullRequestReview":
      return reviewCommentUrlToId(url);
    default:
      throw new Error(`Unexpected comment parent type: ${parentType}`);
  }
}

function getCommentPrefix(parentType: string): NodeAddressT {
  switch (parentType) {
    case "Issue":
      return Prefix.issueComment;
    case "PullRequest":
      return Prefix.pullComment;
    case "PullRequestReview":
      return Prefix.reviewComment;
    default:
      throw new Error(`Unexpected comment parent type: ${parentType}`);
  }
}

function findConnections(
  db: Database,
  parentId: Schema.ObjectId,
  fields: string[]
) {
  return db
    .prepare(
      dedent`\
        SELECT
          connections.object_id as parent,
          connections.fieldname as fieldname,
          connection_entries.child_id AS child
        FROM connection_entries
        JOIN connections
          ON connections.rowid = connection_entries.connection_id
        WHERE parent = ?
          AND fieldname IN (${fields.map((_) => "?").join(",")})
      `
    )
    .all(parentId, ...fields);
}

function findTypeProperties(
  db: Database,
  typename: string,
  fields: string[]
): {[objectId: string]: {[fieldName: string]: any}} {
  const res = db
    .prepare(
      dedent`\
        SELECT
          objects.id AS id,
          primitives.fieldname AS field,
          primitives.value AS json
        FROM primitives
        JOIN objects
          ON primitives.object_id = objects.id
        WHERE typename = ?
          AND fieldname IN (${fields.map((_) => "?").join(",")})
      `
    )
    .all(typename, ...fields);
  const assoc = {};
  for (const {id, field, json} of res) {
    const obj = assoc[id] || {};
    obj[field] = JSON.parse(json);
    assoc[id] = obj;
  }
  return assoc;
}
