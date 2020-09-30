// @flow

import React, {Component, type Node as ReactNode} from "react";
import {Link as RouterLink} from "react-router-dom";
import {StyleSheet, css} from "aphrodite/no-important";

import Colors from "./Colors";

/**
 * A styled link component for both client-side router links and normal
 * external links.
 *
 * For a client-side link, specify `to={routePath}`. For a normal anchor
 * tag, specify `href={href}`.
 *
 * To add Aphrodite styles: if you would normally write
 *
 *     <a className={css(x, y, z)} />
 *
 * then specify `styles={[x, y, z]}`.
 *
 * All other properties, including `children`, are forwarded directly.
 */
type LinkProps = $ReadOnly<{
  ...React$ElementConfig<"a">,
  ...{|+to: string|} | {|+href: string|},
  +styles?: $ReadOnlyArray<
    Object | false | null | void
  > /* Aphrodite styles, as passed to `css` */,
}>;
export default class Link extends Component<LinkProps> {
  render(): ReactNode {
    const {styles: customStyles, children, ...rest} = this.props;
    const linkClass = css(styles.link, customStyles);
    const className = this.props.className
      ? `${linkClass} ${this.props.className}`
      : linkClass;
    const make = (Tag) => (
      <Tag {...rest} className={className}>
        {children}
      </Tag>
    );
    if ("to" in this.props) {
      if (!this.props.to.endsWith("/")) {
        // All our routes have trailing slashes. This must be an error.
        throw new Error("'to' prop must specify route with trailing slash.");
      }
      return make(RouterLink);
    } else if ("href" in this.props) {
      return make("a");
    } else {
      throw new Error("Must specify either 'to' or 'href'.");
    }
  }
}

const colorAttributes = (color) => ({
  color: color,
  fill: color, // for child SVGs
});
const styles = StyleSheet.create({
  link: {
    ...colorAttributes(Colors.brand.medium),
    ":visited": {
      ...colorAttributes(Colors.brand.dark),
    },
    ":active": {
      ...colorAttributes(Colors.accent.medium),
    },
  },
});
