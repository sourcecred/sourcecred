// @flow

import {OdysseyInstance, type Node} from "./instance";

/**
 * An example Odyssey instance, based on work at the Odyssey Hackathon.
 */
export function hackathonExample(): OdysseyInstance {
  // Define the types of nodes allowed in our instance
  const instance = new OdysseyInstance();

  // define our values for the hackathon
  const logistics = instance.addNode("VALUE", "logistics");
  const design = instance.addNode("VALUE", "design");
  const narrative = instance.addNode("VALUE", "narrative");
  const prototype = instance.addNode("VALUE", "prototype");
  const outreach = instance.addNode("VALUE", "outreach");

  // the cast of characters
  const dl = instance.addNode("PERSON", "dandelion");
  const mz = instance.addNode("PERSON", "z zargham");
  const irene = instance.addNode("PERSON", "irene");
  const max = instance.addNode("PERSON", "max");
  const dennis = instance.addNode("PERSON", "dennis");
  const jonathan = instance.addNode("PERSON", "jonathan");
  const lb = instance.addNode("PERSON", "lb");
  const brian = instance.addNode("PERSON", "brian");
  const sarah = instance.addNode("PERSON", "sarah");
  const jmnemo = instance.addNode("PERSON", "@jmnemo");
  const talbott = instance.addNode("PERSON", "jonathan talbott");
  const agata = instance.addNode("PERSON", "agata");

  // the artifacts
  const graphviz = instance.addNode("ARTIFACT", "graph visualizer");
  const backend = instance.addNode("ARTIFACT", "backend");
  const frontend = instance.addNode("ARTIFACT", "frontend");
  const seededPagerank = instance.addNode("ARTIFACT", "seeded pagerank");
  const canvas = instance.addNode(
    "ARTIFACT",
    "the awesome illustrated poster board"
  );
  const logo = instance.addNode("ARTIFACT", "the broken-lightbulb logo");

  instance.addEdge("DEPENDS_ON", prototype, graphviz);
  instance.addEdge("DEPENDS_ON", prototype, backend);
  instance.addEdge("DEPENDS_ON", prototype, frontend);
  instance.addEdge("DEPENDS_ON", frontend, seededPagerank);
  instance.addEdge("DEPENDS_ON", design, graphviz);
  instance.addEdge("DEPENDS_ON", design, frontend);
  instance.addEdge("DEPENDS_ON", design, logo);
  instance.addEdge("DEPENDS_ON", narrative, logo);
  instance.addEdge("DEPENDS_ON", narrative, canvas);

  function addContribution(
    description: string,
    authors: Node[],
    impacted: Node[]
  ) {
    const contrib = instance.addNode("CONTRIBUTION", description);
    for (const author of authors) {
      instance.addEdge("DEPENDS_ON", contrib, author);
    }
    for (const impact of impacted) {
      instance.addEdge("DEPENDS_ON", impact, contrib);
    }
  }

  addContribution(
    "colors for the graph visualizer",
    [dennis, irene, lb, max, dl],
    [design, graphviz]
  );
  addContribution("design for graph visualizer", [dennis], [graphviz, design]);
  addContribution(
    "design for the frontend",
    [dennis, irene],
    [design, frontend]
  );
  addContribution(
    "pre-hack planning and project management",
    [brian],
    [prototype, logistics]
  );
  addContribution("implementing the graph visualizer", [dl], [graphviz]);
  addContribution("implementing seeded PageRank", [dl, mz], [seededPagerank]);
  addContribution("implementing the frontend", [dl, jmnemo], [frontend]);
  addContribution("implementing the backend", [dl], [backend]);
  addContribution("logo--preliminary work", [lb, agata], [logo]);
  addContribution("logo--lightbulb moment", [lb, max], [logo]);
  addContribution("drawing the canvas", [lb], [canvas]);
  addContribution(
    "narrative shaping for canvas",
    [lb, dl, mz],
    [canvas, narrative]
  );
  addContribution("oneline narrative statement", [dl, talbott], [narrative]);
  addContribution("oneline narrative review", [max, dl], [narrative]);
  addContribution("booking hotel stay", [sarah], [logistics]);
  addContribution("booking plane tickets", [sarah], [logistics]);
  addContribution("helping Dennis get into the space", [sarah], [logistics]);
  addContribution(
    "example prototype dataset",
    [mz, brian],
    [prototype, outreach]
  );
  addContribution("final presentation", [dl, prototype], [narrative]);
  addContribution("connection to the common stack", [mz], [outreach]);
  addContribution("discussing the canvas with folks", [lb], [outreach]);
  addContribution("general logistical defense", [jonathan], [logistics]);
  addContribution("recruiting Max & company", [mz], [outreach, logistics]);
  addContribution("forming the team", [mz], [logistics]);

  return instance;
}
