// @flow

import React from "react";
import stringify from "json-stable-stringify";
import {FileUploader} from "./FileUploader";

export class FileUploaderInspectionTest extends React.Component<
  {},
  {|contents: ?string|}
> {
  render() {
    const onUpload = (contents) =>
      this.setState({contents: stringify(contents, {space: 4})});
    return (
      <div>
        <h1>File Uploader Inspection Test</h1>
        <h2>The File Uploader</h2>
        <FileUploader onUpload={onUpload} title="FileUploader">
          Click This Text To Upload A File
        </FileUploader>
        <h2>The Uploaded File</h2>
        <p>{this.state.contents}</p>
      </div>
    );
  }
}
