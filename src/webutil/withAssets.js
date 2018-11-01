// @flow

import React, {type ComponentType} from "react";
import type {Router} from "react-router";

import {Assets} from "./assets";

// Higher-order component to serve as an adapter between React Router
// and `Assets`.
export default function withAssets<Props: {}>(
  C: ComponentType<Props>
): ComponentType<{...$Diff<Props, {assets: Assets | void}>, router: Router}> {
  const result = class WithAssets extends React.Component<{
    ...$Diff<Props, {assets: Assets | void}>,
    router: Router,
  }> {
    _assets: ?Assets;
    render() {
      const assets: Assets = new Assets(this.props.router.createHref("/"));
      if (
        this._assets == null ||
        this._assets.resolve("") !== assets.resolve("")
      ) {
        this._assets = assets;
      }
      return <C {...this.props} assets={assets} />;
    }
  };
  result.displayName = `withAssets(${C.displayName || C.name || "Component"})`;
  return result;
}
