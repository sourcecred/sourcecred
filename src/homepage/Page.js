// @flow

import React, {type Node} from "react";
import {StyleSheet, css} from "aphrodite/no-important";

import type {Assets} from "../webutil/assets";
import Colors from "../webutil/Colors";
import Link from "../webutil/Link";
import GithubLogo from "./GithubLogo";
import TwitterLogo from "./TwitterLogo";
import DiscordLogo from "./DiscordLogo";
import type {RouteData} from "./routeData";
import * as NullUtil from "../util/null";
import {VERSION_SHORT, VERSION_FULL} from "../core/version";

export default class Page extends React.Component<{|
  +assets: Assets,
  +routeData: RouteData,
  +children: Node,
|}> {
  render() {
    return (
      <React.Fragment>
        <div className={css(style.nonFooter)}>
          <header>
            <nav className={css(style.nav)}>
              <ul className={css(style.navList)}>
                <li className={css(style.navItem, style.navItemLeft)}>
                  <Link to="/" styles={[style.navLink, style.navLinkTitle]}>
                    SourceCred
                  </Link>
                </li>
                {this.props.routeData.map(({navTitle, path}) =>
                  NullUtil.map(navTitle, (navTitle) => (
                    <li
                      key={path}
                      className={css(style.navItem, style.navItemRight)}
                    >
                      <Link to={path} styles={[style.navLink]}>
                        {navTitle}
                      </Link>
                    </li>
                  ))
                )}
                <li className={css(style.navItem, style.navItemRight)}>
                  <Link
                    styles={[style.navLink]}
                    href="https://github.com/sourcecred/sourcecred"
                  >
                    <GithubLogo
                      altText="SourceCred Github"
                      className={css(style.navLogoSmall)}
                    />
                  </Link>
                </li>
                <li className={css(style.navItem, style.navItemRight)}>
                  <Link
                    styles={[style.navLink]}
                    href="https://twitter.com/sourcecred"
                  >
                    <TwitterLogo
                      altText="SourceCred Twitter"
                      className={css(style.navLogoSmall)}
                    />
                  </Link>
                </li>
                <li className={css(style.navItem, style.navItemRightSmall)}>
                  <Link
                    styles={[style.navLink]}
                    href="https://discordapp.com/invite/tsBTgc9"
                  >
                    <DiscordLogo
                      altText="Join the SourceCred Discord"
                      className={css(style.navLogoMedium)}
                    />
                  </Link>
                </li>
              </ul>
            </nav>
          </header>
          <main>{this.props.children}</main>
        </div>
        <footer className={css(style.footer)}>
          <div className={css(style.footerWrapper)}>
            <span className={css(style.footerText)}>
              ({VERSION_FULL}) <strong>{VERSION_SHORT}</strong>
            </span>
          </div>
        </footer>
      </React.Fragment>
    );
  }
}

const footerHeight = 30;
const style = StyleSheet.create({
  footer: {
    color: "#666",
    height: footerHeight,
    fontSize: 14,
    position: "relative",
  },
  footerWrapper: {
    textAlign: "right",
    position: "absolute",
    bottom: 5,
    width: "100%",
  },
  footerText: {
    marginRight: 5,
  },
  nonFooter: {
    minHeight: `calc(100vh - ${footerHeight}px)`,
  },
  nav: {
    padding: "20px 50px 0 50px",
    maxWidth: 900,
    margin: "0 auto",
  },
  navLinkTitle: {
    fontSize: 24,
  },
  navItem: {
    display: "inline-block",
  },
  navList: {
    listStyle: "none",
    paddingLeft: 0,
    margin: 0,
    display: "flex",
  },
  navLink: {
    fontFamily: "Roboto Condensed",
    fontSize: 18,
    textDecoration: "none",
    ":hover": {
      textDecoration: "underline",
    },
    ":visited:not(:active)": {
      color: Colors.brand.medium,
      fill: Colors.brand.medium, // for SVG icons
    },
  },
  navItemLeft: {
    flex: 1,
  },
  navItemRight: {
    marginLeft: 20,
  },
  navItemRightSmall: {
    marginLeft: 15,
  },
  navLogoSmall: {
    height: 20,
    width: 20,
  },
  navLogoMedium: {
    height: 25,
    width: 25,
    transform: "translateY(-1px)",
  },
});
