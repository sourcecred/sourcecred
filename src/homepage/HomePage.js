// @flow

import React from "react";

import type {Assets} from "../webutil/assets";
import Link from "../webutil/Link";
import {StyleSheet, css} from "aphrodite/no-important";

export default class HomePage extends React.Component<{|+assets: Assets|}> {
  render() {
    const urls = {
      numpyFunding:
        "https://numfocus.org/blog/numpy-receives-first-ever-funding-thanks-to-moore-foundation",
      opensslFunding:
        "https://arstechnica.com/information-technology/2014/04/tech-giants-chastened-by-heartbleed-finally-agree-to-fund-openssl/",
      graph: "https://en.wikipedia.org/wiki/Graph_(discrete_mathematics)",
      pagerank: "https://en.wikipedia.org/wiki/PageRank",
      ast: "https://en.wikipedia.org/wiki/Abstract_syntax_tree",
      protocolLabs: "https://protocol.ai/",
      discord: "https://discord.gg/tsBTgc9",
      github: "https://github.com/sourcecred/sourcecred",
      contributionsWelcome:
        "https://github.com/sourcecred/sourcecred/issues?q=is%3Aissue+is%3Aopen+label%3A%22contributions+welcome%22",
      readme: "https://github.com/sourcecred/sourcecred/blob/master/README.md",
    };
    return (
      <div className={css(styles.container)}>
        <h1>SourceCred vision</h1>
        <p>
          <strong>The open-source movement is amazing. </strong>
          It’s inspiring that some of our best technology is developed in the
          open and available to everyone.
        </p>

        <p>
          Despite all the value provided by open-source projects, many are
          chronically underfunded. For example, NumPy{" "}
          <Link href={urls.numpyFunding}>
            received no funding at all until 2017
          </Link>, and{" "}
          <Link href={urls.opensslFunding}>
            a world where OpenSSL was funded might have been a world without
            Heartbleed
          </Link>.
        </p>

        <p>
          These projects also impose a heavy burden on maintainers. Popular
          projects have hundreds or thousands of open issues, with many new ones
          being created every day, and only a few overworked volunteers trying
          to triage and respond to them. Burnout is inevitable.
        </p>

        <p>SourceCred is our attempt to help.</p>

        <h2>Mission</h2>
        <p>
          SourceCred aims to empower open-source developers and communities by
          creating a project-specific reputation metric called <em>cred</em>.
        </p>

        <p>
          A project’s contributors earn cred for helping out. For example, a
          project might reward:
        </p>
        <ul style={{marginTop: "-1.5ex"}}>
          <li>Triaging issues</li>
          <li>Maintaining the build</li>
          <li>Fixing bugs</li>
          <li>Writing documentation</li>
          <li>Refactoring code</li>
          <li>Adding features</li>
        </ul>

        <p>
          SourceCred will build social capital within communities, recognize
          their hardworking contributors, and encourage more people to help
          maintain and develop open-source projects.
        </p>

        <p>We’re designing SourceCred around the following four principles:</p>

        <dl>
          <Dt>Transparency</Dt>
          <Dd>
            It should be easy to see why cred is attributed as it is, and link a
            person’s cred directly to contributions they’ve made.
          </Dd>
          <Dt>Extensibility</Dt>
          <Dd>
            SourceCred is designed around a plugin architecture, so you can add
            support for new data sources, new algorithms, or even entirely new
            kinds of work.
          </Dd>
          <Dt>Community control</Dt>
          <Dd>
            Each community has the final say on that community’s cred. When the
            algorithm and the community disagree, the community wins.
          </Dd>
          <Dt>Decentralization</Dt>
          <Dd>
            Projects own their own data, and control their own cred. The
            SourceCred project provides tools, but has no control.
          </Dd>
        </dl>

        <h2>How cred works</h2>
        <p>
          Cred is computed by first creating a contribution{" "}
          <Link href={urls.graph}>graph</Link>
          , which contains every contribution to the project and the relations
          among them. For example, GitHub issues, Git commits, and individual
          files and functions can be included in the graph. Then, SourceCred
          runs a modified version of <Link href={urls.pagerank}>
            PageRank
          </Link>{" "}
          on that graph to produce a cred attribution. The attribution is highly
          configurable; project maintainers can add new heuristics and adjust
          weights.
        </p>

        <p>
          This approach satisfies our four principles. It’s transparent: you can
          always see how a node’s weight dervies from its neighbors. It’s
          extensible: plugins can embed new types of nodes and edges into the
          graph. It’s community-controlled: the weights, heuristics, and
          algorithms are all configured by the project. Finally, it’s
          decentralized: every project can run its own instance.
        </p>

        <p>
          Naturally, there will be attempts to game the system. We’ll provide
          tools that make it obvious when people are gaming their cred, and
          empower maintainers to moderate and correct the attribution when
          needed. In case of deeply contentious disagreements, cred can be
          forked alongside the project.
        </p>

        <h2>Roadmap</h2>
        <p>
          SourceCred is under active development.{" "}
          <Link to="/prototype/">We have a prototype</Link> that ingests data
          from Git and GitHub, computes cred, and allows the user to explore and
          experiment on the results. We have a long way to go to realize
          SourceCred’s full vision, but the prototype can already surface some
          interesting insights!
        </p>

        <p>
          In the near term, we want to help with issue triage and
          prioritization. Open-source projects are drowning in issues; many
          people file them, but few are motivated to triage them. We want to
          recognize the people who show up to do that work, and reward them by
          giving them more influence over issue prioritization.
        </p>

        <p>
          In the longer term, we will continue to add signal to cred
          attribution. For example, we plan to parse the{" "}
          <Link href={urls.ast}>AST</Link> of a project’s code so that we can
          attribute cred at the level of individual functions, and create a
          “spotlight” mechanic that will let contributors flow more cred to
          their peers’ important contributions. As SourceCred improves, we have
          plans for how to use it to help open-source projects become
          financially sustainable.
        </p>

        <h2>About</h2>
        <p>
          SourceCred is an open-source project, and is committed to being
          decentralized. We don’t think communities should have to give their
          data to us, or entrust us with control over their cred. The lead
          developers are grateful to be supported by{" "}
          <Link href={urls.protocolLabs}>Protocol Labs</Link>.
        </p>

        <p>
          If you think this vision is exciting, we’d love for you to get
          involved! You can join our <Link href={urls.discord}>Discord</Link>{" "}
          and check out our <Link href={urls.github}>GitHub</Link>—many of our
          issues are marked{" "}
          <Link href={urls.contributionsWelcome}>contributions welcome</Link>.
          If you want to try running SourceCred on open-source projects you care
          about, check out <Link href={urls.readme}>our README</Link>.
        </p>
      </div>
    );
  }
}

function Dt(props) {
  return <dt style={{fontWeight: "bold"}}>{props.children}</dt>;
}

function Dd(props) {
  return <dd style={{marginBottom: 15}}>{props.children}</dd>;
}

const styles = StyleSheet.create({
  container: {
    maxWidth: 900,
    margin: "0 auto",
    marginBottom: 200,
    padding: "0 10px",
    lineHeight: 1.5,
    fontSize: 20,
  },
});
