// @flow

import React, {type Node as ReactNode} from "react";
import stringify from "json-stable-stringify";
import {FileUploader} from "../../util/FileUploader";
import Link from "../../webutil/Link";
import {MdFileDownload, MdFileUpload} from "react-icons/md";
import {type WeightsT, toJSON, fromJSON} from "../../core/weights";

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
        <Link
          download="weights.json"
          title="Download your weights.json"
          href={`data:text/json,${weightsJSON}`}
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
