// @flow

import stringify from "json-stable-stringify";
import React from "react";
import {FileUploader} from "../../util/FileUploader";
import Link from "../../webutil/Link";
import {MdFileDownload, MdFileUpload} from "react-icons/md";
import {type Weights, toJSON, fromJSON} from "../../analysis/weights";

export type Props = {|
  +weights: Weights,
  +onWeightsChange: (Weights) => void,
|};
export class WeightsFileManager extends React.Component<Props> {
  render() {
    const weightsJSON = stringify(toJSON(this.props.weights));
    const onUpload = (json) => this.props.onWeightsChange(fromJSON(json));
    return (
      <div>
        <Link
          download="weights.json"
          title="Download your weights.json"
          href={`data:text/json,${weightsJSON}`}
          style={{color: "black"}}
        >
          <MdFileDownload style={{margin: "2px"}} />
        </Link>
        <FileUploader title="Upload weights.json" onUpload={onUpload}>
          <MdFileUpload style={{margin: "2px"}} />
        </FileUploader>
      </div>
    );
  }
}
