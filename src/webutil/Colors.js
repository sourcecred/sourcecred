// @flow

import deepFreeze from "deep-freeze";
export type HexColor = string;

export default (deepFreeze({
  brand: {
    medium: "#0872A2",
    dark: "#3A066A",
  },
  accent: {
    medium: "#FF3201",
  },
}): {|
  +brand: {|
    +medium: HexColor,
    +dark: HexColor,
  |},
  +accent: {|
    +medium: HexColor,
  |},
|});
