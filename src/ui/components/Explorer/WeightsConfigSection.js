// @flow
import React, {type Node as ReactNode} from "react";
import {Grid} from "@material-ui/core";
import {makeStyles} from "@material-ui/core/styles";
import {type PluginDeclarations} from "../../../analysis/pluginDeclaration";
import {type WeightsT} from "../../../core/weights";
import {WeightConfig} from "../../weights/WeightConfig";
import {WeightsFileManager} from "../../weights/WeightsFileManager";

export type WeightConfigSectionProps = {|
  show: boolean,
  pluginDeclarations: PluginDeclarations,
  weights: WeightsT,
  setWeightsState: ({weights: WeightsT}) => void,
|};

const useStyles = makeStyles(() => ({
  weightConfig: {
    marginTop: 10,
  },
}));

const WeightsConfigSection = ({
  show,
  pluginDeclarations,
  weights,
  setWeightsState,
}: WeightConfigSectionProps): ReactNode => {
  if (!show) return [];

  const classes = useStyles();

  return (
    <Grid container>
      <Grid container className={classes.weightConfig} spacing={2}>
        <Grid container item xs={12} direction="column">
          <Grid>
            <Grid>
              This page loads your current config/weights.json file, if one
              exists. Once you are done configuring weights, download the file
              and put it in your /config directory in your instance as
              weights.json. To see new scores, re-calculate scores using the
              CLI.
            </Grid>
            <Grid>
              <WeightsFileManager
                weights={weights}
                onWeightsChange={(weights: WeightsT) => {
                  setWeightsState({weights});
                }}
              />
            </Grid>
          </Grid>
        </Grid>
        <Grid spacing={2} container item xs={12} style={{display: "flex"}}>
          <WeightConfig
            declarations={pluginDeclarations}
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
