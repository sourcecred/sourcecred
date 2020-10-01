// @flow

import React, {type Node as ReactNode} from "react";

export type Props = {|
  +onUpload: (any) => void,
  +title: string,
  +children: ReactNode,
|};

/**
 * A component that allows the user to upload a JSON file.
 *
 * The provided file will be parsed as JSON and provided to the onUpload callback.
 */
// NOTE: This file is tested via the FileUploaderInspectionTest.
// If you make changes to this file, you are responsible for following
// the instructions in the Inspection Test to ensure that the component
// still works.
// You may do so by running `yarn start` and navigating to:
// http://localhost:8080/test/FileUploader/
export class FileUploader extends React.Component<Props> {
  render(): ReactNode {
    const onUpload = (e) => {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        const jsonString = reader.result;
        if (typeof jsonString !== "string") {
          throw new Error("Unexpected: jsonString is not string");
        }
        const json = JSON.parse(jsonString);
        this.props.onUpload(json);
      };
      reader.readAsText(file);
    };
    return (
      // The input styling hides the "Choose File" button to give us control
      // over the UI, but ensures that it is still accessible via the keyboard.
      // https://snook.ca/archives/html_and_css/hiding-content-for-accessibility
      <label title={this.props.title}>
        {this.props.children}
        <input
          type="file"
          accept=".json"
          style={{
            position: "absolute !important",
            height: "1px",
            width: "1px",
            overflow: "hidden",
            clip: "rect(1px, 1px, 1px, 1px)",
          }}
          onChange={onUpload}
        />
      </label>
    );
  }
}
