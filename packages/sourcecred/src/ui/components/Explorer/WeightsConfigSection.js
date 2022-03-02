// @flow
import React, {type Node as ReactNode} from "react";
import {Grid} from "@material-ui/core";
import {makeStyles} from "@material-ui/core/styles";
import {type PluginDeclaration} from "../../../analysis/pluginDeclaration";
import {type WeightsT} from "../../../core/weights";
import {WeightConfig} from "../../weights/WeightConfig";
import {WeightsFileManager} from "../../weights/WeightsFileManager";
import Paper from "@material-ui/core/Paper";

export type WeightConfigSectionProps = {|
  show: boolean,
  pluginDeclarations: $ReadOnlyArray<PluginDeclaration>,
  weights: WeightsT,
  setWeightsState: ({weights: WeightsT}) => void,
|};

const useStyles = makeStyles(() => ({
  weightConfig: {
    marginTop: 10,
  },
  container: {
    padding: "20px 20px 20px 28px",
    marginLeft: "3px",
    marginRight: "-15px",
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
    <Paper className={classes.container}>
    <h1 className={`${classes.centerRow} ${classes.pageHeader}`}>
        Configure CredRank Weights
      </h1>
      <Grid container>
        <Grid container className={classes.weightConfig} spacing={2}>
          <Grid container item xs={12} direction="column">
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
          <Grid spacing={2} container item xs={12}>
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
    </Paper>
  );
};

export default WeightsConfigSection;
