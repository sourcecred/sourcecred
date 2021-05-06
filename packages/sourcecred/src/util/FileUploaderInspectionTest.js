// @flow

import React, {type Node as ReactNode} from "react";
import Markdown from "react-markdown";
import {MdFileUpload} from "react-icons/md";

import dedent from "./dedent";
import stringify from "json-stable-stringify";
import {FileUploader} from "./FileUploader";
import type {Assets} from "../webutil/assets";

export default class FileUploaderInspectionTest extends React.Component<
  {|+assets: Assets|},
  {|json: ?mixed|}
> {
  state: {|json: mixed|} = {json: null};
  render(): ReactNode {
    const onUpload = (json) => {
      this.setState({json});
    };
    const displayContents = stringify(this.state.json, {space: 4});
    return (
      <div>
        <Markdown
          source={dedent`
# File Uploader Inspection Test

## Expected Behavior:
- There is a File Upload icon, but no "Choose File" box
- The file upload icon has a title of "FileUploader" (mouse over to see it)
- Clicking the File Upload icon opens a file upload dialogue
- The file upload dialogue displays that only .json files are valid
- Selecting a valid .json file results in the JSON content getting printed below the uploader
- That JSON content is pretty printed with spaces (verifies that the result was provided as JSON, not as a string)
- Selecting an invalid file results in an error being thrown to the console
- It's possible to navigate to the file uploader via the keyboard
      `}
        />
        <h2>The File Uploader</h2>
        <FileUploader onUpload={onUpload} title="FileUploader">
          <MdFileUpload />
        </FileUploader>
        <h2>The Uploaded File</h2>
        {this.state.json ? (
          <pre style={{backgroundColor: "#efefef"}}>{displayContents}</pre>
        ) : (
          <p>{"No JSON uploaded."}</p>
        )}
      </div>
    );
  }
}
