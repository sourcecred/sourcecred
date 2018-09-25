// @flow

export type HexColor = string;

export default (Object.freeze({
  brand: Object.freeze({
    medium: "#0872A2",
    dark: "#3A066A",
  }),
  accent: Object.freeze({
    medium: "#FF3201",
  }),
}): {|
  +brand: {|
    +medium: HexColor,
    +dark: HexColor,
  |},
  +accent: {|
    +medium: HexColor,
  |},
|});
