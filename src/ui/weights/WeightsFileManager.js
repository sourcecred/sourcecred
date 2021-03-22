// @flow

import React, {type Node as ReactNode} from "react";
import stringify from "json-stable-stringify";
import {FileUploader} from "../../util/FileUploader";
import {type WeightsT, toJSON, fromJSON} from "../../core/weights";
import {Button, ButtonGroup} from "@material-ui/core";

export type Props = {|
  +weights: WeightsT,
  +onWeightsChange: (WeightsT) => void,
|};
export class WeightsFileManager extends React.Component<Props> {
  render(): ReactNode {
    const weightsJSON = stringify(toJSON(this.props.weights));
    const onUpload = (json) => this.props.onWeightsChange(fromJSON(json));
    return (
      <div>
        <ButtonGroup color="primary" variant="contained">
          <FileUploader title="Upload weights.json" onUpload={onUpload}>
            <Button variant="contained" color="primary" component="span">
              Upload Weights
            </Button>
          </FileUploader>
          <Button
            download="weights.json"
            title="Download your weights.json"
            href={`data:text/json,${weightsJSON}`}
          >
            Download Weights
          </Button>
        </ButtonGroup>
      </div>
    );
  }
}
