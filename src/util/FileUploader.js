// @flow

import React, {type Node as ReactNode} from "react";

export type Props = {|
  +onUpload: (mixed) => void,
  +title: string,
  +children: ReactNode,
|};

/**
 * A component that allows the user to upload a JSON file.
 *
 * The provided file will be parsed as JSON and provided to the onUpload callback.
 */
// WARNING: This file is not tested. If you make changes to it, you are responsible
// for testing those changes manually!
export class FileUploader extends React.Component<Props> {
  render() {
    const onUpload = (e) => {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const jsonString = e.target.result;
        const json = JSON.parse(jsonString);
        this.props.onUpload(json);
      };
      reader.readAsText(file);
    };
    return (
      <label title={this.props.title}>
        {this.props.children}
        <input type="file" accepts=".json" onChange={onUpload} />
      </label>
    );
  }
}
