// @flow

import React, {type Node} from "react";
import {Link} from "react-router";
import {StyleSheet, css} from "aphrodite/no-important";
import styles from './style/styles';

import {routeData} from "./routeData";
import * as NullUtil from "../util/null";

export default class Page extends React.Component<{|+children: Node|}> {
  render() {
    return (
      <div>
        <header>
          <nav className={css(style.nav)}>
            <ul className={css(style.navList)}>
              <li className={css([style.navItem, style.navItemLeft])}>
                <Link
                  to="/"
                  className={css([style.navLinkTitle, style.navLink, style.navLinkHover])}
                >SourceCred</Link>
              </li>
              {routeData.map(({navTitle, path}) =>
                NullUtil.map(navTitle, (navTitle) => (
                  <li key={path} className={css([style.navItem, style.navItemRight])}>
                    <Link
                      to={path}
                      className={css([style.navLink, style.navLinkHover])}
                    >{navTitle}</Link>
                  </li>
                ))
              )}
              <li className={css([style.navItem, style.navItemRight])}>
                <a
                  className={css([style.navLink, style.navLinkHover])}
                  href="https://github.com/sourcecred/sourcecred"
                  >
                    <svg className={css([style.ghLogo, style.ghLogoHover])} viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
                      <path d="M512 0C229.25 0 0 229.25 0 512c0 226.25 146.688 418.125 350.156 485.812 25.594 4.688 34.938-11.125 34.938-24.625 0-12.188-0.469-52.562-0.719-95.312C242 908.812 211.906 817.5 211.906 817.5c-23.312-59.125-56.844-74.875-56.844-74.875-46.531-31.75 3.53-31.125 3.53-31.125 51.406 3.562 78.47 52.75 78.47 52.75 45.688 78.25 119.875 55.625 149 42.5 4.654-33 17.904-55.625 32.5-68.375C304.906 725.438 185.344 681.5 185.344 485.312c0-55.938 19.969-101.562 52.656-137.406-5.219-13-22.844-65.094 5.062-135.562 0 0 42.938-13.75 140.812 52.5 40.812-11.406 84.594-17.031 128.125-17.219 43.5 0.188 87.312 5.875 128.188 17.281 97.688-66.312 140.688-52.5 140.688-52.5 28 70.531 10.375 122.562 5.125 135.5 32.812 35.844 52.625 81.469 52.625 137.406 0 196.688-119.75 240-233.812 252.688 18.438 15.875 34.75 47 34.75 94.75 0 68.438-0.688 123.625-0.688 140.5 0 13.625 9.312 29.562 35.25 24.562C877.438 930 1024 738.125 1024 512 1024 229.25 794.75 0 512 0z" />
                    </svg>
                </a>
              </li>
              <li className={css([style.navItem, style.navItemRight])}>
                <a
                  className={css([style.navLink, style.navLinkHover])}
                  href="https://twitter.com/sourcecred"
                  >
                  <svg className={css([style.ghLogo, style.ghLogoHover])} version="1.1" xmlns="http://www.w3.org/2000/svg" x="0px" y="0px"
                     viewBox="0 0 512 512">
                  <path d="M512,97.209c-18.838,8.354-39.082,14.001-60.329,16.54c21.687-13,38.343-33.585,46.187-58.114
                    c-20.299,12.038-42.778,20.779-66.705,25.489c-19.16-20.415-46.461-33.17-76.674-33.17c-58.012,0-105.043,47.029-105.043,105.039
                    c0,8.233,0.929,16.25,2.72,23.939c-87.3-4.382-164.701-46.2-216.509-109.753c-9.042,15.514-14.224,33.558-14.224,52.809
                    c0,36.444,18.544,68.596,46.73,87.433c-17.219-0.546-33.416-5.271-47.577-13.139c-0.01,0.438-0.01,0.878-0.01,1.321
                    c0,50.894,36.209,93.348,84.261,103c-8.813,2.398-18.094,3.686-27.674,3.686c-6.77,0-13.349-0.66-19.764-1.887
                    c13.367,41.73,52.159,72.104,98.126,72.949c-35.95,28.175-81.243,44.967-130.458,44.967c-8.479,0-16.841-0.497-25.059-1.471
                    c46.486,29.806,101.701,47.197,161.021,47.197c193.211,0,298.868-160.063,298.868-298.873c0-4.554-0.104-9.084-0.305-13.59
                    C480.11,136.773,497.918,118.273,512,97.209z"/>
                  </svg>
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

const style = StyleSheet.create(styles);
