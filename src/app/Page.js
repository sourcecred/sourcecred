// @flow

import React, {type Node} from "react";
import {Link} from "react-router";
import {StyleSheet, css} from "aphrodite/no-important";
import GithubLogo from "./GithubLogo";
import TwitterLogo from "./TwitterLogo";
import {routeData} from "./routeData";
import * as NullUtil from "../util/null";

export default class Page extends React.Component<{|+children: Node|}> {
  render() {
    return (
      <div>
        <header>
          <nav className={css(style.nav)}>
            <ul className={css(style.navList)}>
              <li className={css(style.navItem, style.navItemLeft)}>
                <Link
                  to="/"
                  className={css(
                    style.navLinkTitle,
                    style.navLink,
                    style.navLinkHover
                  )}
                >
                  SourceCred
                </Link>
              </li>
              {routeData.map(({navTitle, path}) =>
                NullUtil.map(navTitle, (navTitle) => (
                  <li
                    key={path}
                    className={css(style.navItem, style.navItemRight)}
                  >
                    <Link
                      to={path}
                      className={css(style.navLink, style.navLinkHover)}
                    >
                      {navTitle}
                    </Link>
                  </li>
                ))
              )}
              <li className={css(style.navItem, style.navItemRight)}>
                <a
                  className={css(style.navLink, style.navLinkHover)}
                  href="https://github.com/sourcecred/sourcecred"
                >
                  <GithubLogo
                    altText="SourceCred Github"
                    className={css(style.navLogo, style.navLogoHover)}
                  />
                </a>
              </li>
              <li className={css(style.navItem, style.navItemRight)}>
                <a
                  className={css(style.navLink, style.navLinkHover)}
                  href="https://twitter.com/sourcecred"
                >
                  <TwitterLogo
                    altText="SourCred Twitter"
                    className={css(style.navLogo, style.navLogoHover)}
                  />
                </a>
              </li>
            </ul>
          </nav>
        </header>
        <main>{this.props.children}</main>
      </div>
    );
  }
}

const style = StyleSheet.create({
  header: {
    color: "#1297A1",
    fontFamily: '"Roboto Condensed", sans-serif',
  },
  body: {
    padding: "0 100px",
    flex: 3,
  },
  nav: {
    height: 60,
    padding: "20px 100px",
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
    color: "#00848B",
    fontFamily: "Roboto Condensed",
    fontSize: 18,
    textDecoration: "none",
  },
  navLinkHover: {
    ":hover": {
      color: "#08A27F",
      textDecoration: "underline",
    },
  },
  navItemLeft: {
    flex: 1,
  },
  navItemRight: {
    marginLeft: 20,
  },
  logoImg: {
    height: 20,
  },
  navLogo: {
    height: 20,
    width: 20,
    fill: "#00848B",
  },
  navLogoHover: {
    ":hover": {
      fill: "#08A27F",
    },
  },
});
