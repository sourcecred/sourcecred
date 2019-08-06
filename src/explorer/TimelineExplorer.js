// @flow

import React from "react";
import deepEqual from "lodash.isequal";
import {type PluginDeclaration} from "../analysis/pluginDeclaration";
import {type Weights, copy as weightsCopy} from "../analysis/weights";
import {
  TimelineCred,
  type TimelineCredParameters,
} from "../analysis/timeline/timelineCred";
import {TimelineCredView} from "./TimelineCredView";
import {WeightConfig} from "./weights/WeightConfig";
import {WeightsFileManager} from "./weights/WeightsFileManager";
import {format} from "d3-format";

export type Props = {
  projectId: string,
  initialTimelineCred: TimelineCred,
  // TODO: Get this info from the TimelineCred
  declarations: $ReadOnlyArray<PluginDeclaration>,
};

export type State = {
  timelineCred: TimelineCred,
  weights: Weights,
  alpha: number,
  intervalDecay: number,
  loading: boolean,
  showWeightConfig: boolean,
};

/**
 * TimelineExplorer allows displaying, exploring, and re-calculating TimelineCred.
 *
 * It basically wraps a TimelineCredView with some additional features and options:
 * - allows changing the weights and re-calculating cred with new weights
 * - allows saving/loading weights
 * - displays the string
 */
export class TimelineExplorer extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    const timelineCred = props.initialTimelineCred;
    const {alpha, intervalDecay, weights} = timelineCred.params();
    this.state = {
      selectedNodeTypePrefix: timelineCred.config().scoreNodePrefix,
      timelineCred,
      alpha,
      intervalDecay,
      // Set the weights to a copy, to ensure we don't mutate the weights in the
      // initialTimelineCred. This enables e.g. disabling the analyze button
      // when the parameters are unchanged.
      weights: weightsCopy(weights),
      loading: false,
      showWeightConfig: false,
    };
  }

  params(): TimelineCredParameters {
    const {alpha, intervalDecay, weights} = this.state;
    // Set the weights to a copy, to ensure that the weights we pass into e.g.
    // analyzeCred are a distinct reference from the one we keep in our state.
    return {alpha, intervalDecay, weights: weightsCopy(weights)};
  }

  async analyzeCred() {
    this.setState({loading: true});
    const timelineCred = await this.state.timelineCred.reanalyze(this.params());
    this.setState({timelineCred, loading: false});
  }

  renderConfigurationRow() {
    const {showWeightConfig} = this.state;
    const weightFileManager = (
      <WeightsFileManager
        weights={this.state.weights}
        onWeightsChange={(weights: Weights) => {
          this.setState({weights});
        }}
      />
    );
    const weightConfig = (
      <WeightConfig
        declarations={this.props.declarations}
        nodeTypeWeights={this.state.weights.nodeTypeWeights}
        edgeTypeWeights={this.state.weights.edgeTypeWeights}
        onNodeWeightChange={(prefix, weight) => {
          this.setState(({weights}) => {
            weights.nodeTypeWeights.set(prefix, weight);
            return {weights};
          });
        }}
        onEdgeWeightChange={(prefix, weight) => {
          this.setState(({weights}) => {
            weights.edgeTypeWeights.set(prefix, weight);
            return {weights};
          });
        }}
      />
    );

    const alphaSlider = (
      <input
        type="range"
        min={0.05}
        max={0.95}
        step={0.05}
        value={this.state.alpha}
        onChange={(e) => {
          this.setState({alpha: e.target.valueAsNumber});
        }}
      />
    );
    const paramsUpToDate = deepEqual(
      this.params(),
      this.state.timelineCred.params()
    );
    const analyzeButton = (
      <button
        disabled={this.state.loading || paramsUpToDate}
        onClick={() => this.analyzeCred()}
      >
        re-compute cred
      </button>
    );
    return (
      <div>
        <div style={{marginTop: 30, display: "flex"}}>
          <span style={{paddingLeft: 30}}>
            cred for {this.props.projectId}
            <a href={`/prototype/${this.props.projectId}/`}>(legacy)</a>
          </span>
          <span style={{flexGrow: 1}} />
          <span>α</span>
          {alphaSlider}
          <span>{format(".2f")(this.state.alpha)}</span>
          <button
            onClick={() => {
              this.setState(({showWeightConfig}) => ({
                showWeightConfig: !showWeightConfig,
              }));
            }}
          >
            {showWeightConfig
              ? "Hide weight configuration"
              : "Show weight configuration"}
          </button>
          {analyzeButton}
        </div>
        {showWeightConfig && (
          <div style={{marginTop: 10}}>
            <span>Upload/Download weights:</span>
            {weightFileManager}
            {weightConfig}
          </div>
        )}
      </div>
    );
  }

  render() {
    const timelineCredView = (
      <TimelineCredView
        timelineCred={this.state.timelineCred}
        selectedNodeFilter={this.state.timelineCred.config().scoreNodePrefix}
      />
    );
    return (
      <div style={{width: 900, margin: "0 auto"}}>
        {this.renderConfigurationRow()}
        {timelineCredView}
      </div>
    );
  }
}
