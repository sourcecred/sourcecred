// @flow

import React, {type ComponentType} from "react";

import type {RepoId} from "../core/repoId";
import type {Assets} from "../webutil/assets";

export default function makeProjectPage(
  repoId: RepoId
): ComponentType<{|+assets: Assets|}> {
  return class ProjectPage extends React.Component<{|+assets: Assets|}> {
    render() {
      return (
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            marginBottom: 200,
            padding: "0 10px",
            lineHeight: 1.5,
          }}
        >
          <p>
            <strong>TODO:</strong> Render an explorer for{" "}
            {`${repoId.owner}/${repoId.name}`}
          </p>.
        </div>
      );
    }
  };
}
