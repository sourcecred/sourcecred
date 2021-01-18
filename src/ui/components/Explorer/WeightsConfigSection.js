// @flow
import React, {type Node as ReactNode} from "react";
import {Grid, Slider} from "@material-ui/core";
import {makeStyles} from "@material-ui/core/styles";
import {format} from "d3-format";
import {CredView} from "../../../analysis/credView";
import {type TimelineCredParameters} from "../../../analysis/timeline/params";
import {type WeightsT} from "../../../core/weights";
import {WeightConfig} from "../../weights/WeightConfig";
import {WeightsFileManager} from "../../weights/WeightsFileManager";

export type WeightConfigSectionProps = {|
  show: boolean,
  credView: CredView,
  weights: WeightsT,
  setWeightsState: ({weights: WeightsT}) => void,
  params: TimelineCredParameters,
  setParams: (TimelineCredParameters) => void,
|};

const useStyles = makeStyles(() => ({
  weightConfig: {
    marginTop: 10,
  },
}));

const WeightsConfigSection = ({
  show,
  credView,
  weights,
  setWeightsState,
  params,
  setParams,
}: WeightConfigSectionProps): ReactNode => {
  if (!show) return [];

  const classes = useStyles();

  return (
    <Grid container>
      <Grid container className={classes.weightConfig} spacing={2}>
        <Grid container item xs={12} direction="column">
          <Grid>
            <Grid>Upload/Download weights:</Grid>
            <Grid>
              <WeightsFileManager
                weights={weights}
                onWeightsChange={(weights: WeightsT) => {
                  setWeightsState({weights});
                }}
              />
            </Grid>
          </Grid>
          <Grid container item spacing={2} alignItems="center">
            <Grid>α</Grid>
            <Grid item xs={2}>
              <Slider
                value={params.alpha}
                min={0.05}
                max={0.95}
                step={0.05}
                valueLabelDisplay="auto"
                onChange={(_, val) => {
                  setParams({
                    ...params,
                    alpha: val,
                  });
                }}
              />
            </Grid>
            <Grid>{format(".2f")(params.alpha)}</Grid>
          </Grid>
        </Grid>
        <Grid spacing={2} container item xs={12} style={{display: "flex"}}>
          <WeightConfig
            declarations={credView.plugins()}
            nodeWeights={weights.nodeWeights}
            edgeWeights={weights.edgeWeights}
            onNodeWeightChange={(prefix, weight) => {
              weights.nodeWeights.set(prefix, weight);

              setWeightsState({weights});
            }}
            onEdgeWeightChange={(prefix, weight) => {
              weights.edgeWeights.set(prefix, weight);
              setWeightsState({weights});
            }}
          />
        </Grid>
      </Grid>
    </Grid>
  );
};

export default WeightsConfigSection;
