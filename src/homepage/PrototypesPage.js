// @flow

import React, {type ComponentType} from "react";

import Link from "../webutil/Link";
import type {Assets} from "../webutil/assets";

export default function makePrototypesPage(
  projectIds: $ReadOnlyArray<string>
): ComponentType<{|+assets: Assets|}> {
  return class PrototypesPage extends React.Component<{|+assets: Assets|}> {
    render() {
      return (
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            padding: "0 10px",
            lineHeight: 1.5,
            height: "100%",
          }}
        >
          <p>Select a project:</p>
          <ul>
            {projectIds.map((projectId) => (
              <li key={projectId}>
                <Link to={`/timeline/${projectId}/`}>{`${projectId}`}</Link>
              </li>
            ))}
          </ul>
        </div>
      );
    }
  };
}
