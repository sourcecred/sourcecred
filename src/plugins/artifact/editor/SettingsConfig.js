// @flow

import React from "react";

import LocalStore from "./LocalStore";

export type Settings = {
  githubApiToken: string,
  repoOwner: string,
  repoName: string,
};

type Props = {
  onChange: (Settings) => void,
};
type State = Settings;

const LOCAL_STORE_SETTINGS_KEY = "SettingsConfig.settings";

export function defaultSettings() {
  return {
    githubApiToken: "",
    repoOwner: "",
    repoName: "",
  };
}

export class SettingsConfig extends React.Component<Props, State> {
  constructor() {
    super();
    this.state = defaultSettings();
  }

  componentDidMount() {
    this.setState(LocalStore.get(LOCAL_STORE_SETTINGS_KEY, this.state), () => {
      this.props.onChange(this.state);
    });
  }

  render() {
    return (
      <div>
        <label>
          API token{" "}
          <input
            value={this.state.githubApiToken}
            onChange={(e) => {
              const value = e.target.value;
              this.setState(
                (state) => ({
                  githubApiToken: value,
                }),
                this._updateSettings.bind(this)
              );
            }}
          />
        </label>
        <br />
        <label>
          Repository owner{" "}
          <input
            value={this.state.repoOwner}
            onChange={(e) => {
              const value = e.target.value;
              this.setState(
                (state) => ({
                  repoOwner: value,
                }),
                this._updateSettings.bind(this)
              );
            }}
          />
        </label>
        <br />
        <label>
          Repository name{" "}
          <input
            value={this.state.repoName}
            onChange={(e) => {
              const value = e.target.value;
              this.setState(
                (state) => ({
                  repoName: value,
                }),
                this._updateSettings.bind(this)
              );
            }}
          />
        </label>
      </div>
    );
  }

  _updateSettings() {
    LocalStore.set(LOCAL_STORE_SETTINGS_KEY, this.state);
    this.props.onChange(this.state);
  }
}
