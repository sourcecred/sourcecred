// @flow

import React from "react";
import Markdown from "react-markdown";
import {sum} from "d3-array";
import {type NodeAddressT} from "../core/graph";
import {TimelineCredChart} from "./TimelineCredChart";
import {format} from "d3-format";
import {TimelineCred} from "../analysis/timeline/timelineCred";
import {TimelineCredView} from "../analysis/timeline/timelineCredView";

export type Props = {|
  +timelineCred: TimelineCred,
  +selectedNodeFilter: NodeAddressT,
|};

const MAX_ENTRIES_PER_LIST = 100;
const DEFAULT_ENTRIES_PER_CHART = 6;

/**
 * Render a view on TimelineCred.
 *
 * Takes a TimelineCred instance and a node filter as props. It will display
 * cred for nodes that match the filter.
 *
 * The top `DEFAULT_ENTRIES_PER_CHART` nodes (by total cred across time) will
 * be rendered in a TimelineCredChart. There is also a table showing the top
 * `MAX_ENTRIES_PER_LIST` nodes (also by total cred across time).
 *
 * For a demo, check out TimelineCredViewInspectionTest by running `yarn start`
 * and then navigating to:
 * http://localhost:8080/test/TimelineCredView/
 */
export class TimelineCredViewRenderer extends React.Component<Props> {
  render() {
    const {selectedNodeFilter, timelineCred} = this.props;
    const timelineCredView = new TimelineCredView(timelineCred);
    const nodes = timelineCredView.credSortedNodes(selectedNodeFilter);
    const tableNodes = nodes.slice(0, MAX_ENTRIES_PER_LIST);
    const chartNodes = nodes
      .slice(0, DEFAULT_ENTRIES_PER_CHART)
      .map((x) => x.node.address);
    const totalScore = sum(nodes.map((x) => x.total));
    return (
      <div style={{width: 1000, margin: "0 auto"}}>
        <TimelineCredChart
          timelineCred={timelineCred}
          displayedNodes={chartNodes}
        />
        <table style={{width: 600, margin: "0 auto", padding: "20px 10px"}}>
          <thead>
            <tr>
              <th>Contributor</th>
              <th style={{textAlign: "right"}}>Cred</th>
              <th style={{textAlign: "right"}}>% Total</th>
            </tr>
          </thead>
          <tbody>
            {tableNodes.map(({node, total}) => {
              return (
                <tr key={node.address}>
                  <td>
                    <Markdown
                      renderers={{paragraph: "span"}}
                      source={node.description}
                    />
                  </td>
                  <td style={{textAlign: "right"}}>{format(".1d")(total)}</td>
                  <td style={{textAlign: "right"}}>
                    {format(".1%")(total / totalScore)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
}
