// For graph visualization: inspiration and code from Ryan Morton:
// https://discourse.sourcecred.io/t/research-design-exploratory-data-analysis/67
// For React integration: this is a hacky mess based on the first approach described
// in this blog post: https://www.smashingmagazine.com/2018/02/react-d3-ecosystem/
export class GraphVisualizer extends React.Component<Props> {
  _rootNode: HTMLDivElement | null;
  simulation: any;
  _maxScore: number;

  _chart: any;
  _nodesG: any;
  _edgesG: any;
  _textG: any;
  _tooltip: any;
  _mouseOver: any;
  _mouseOff: any;
  _ticked: any;
  _selectedNodeHalo: any;
  _selectedNeighborHalo: any;
  linkForce: any;
  _svg: any;

  _computeMax() {
    this._maxScore = -Infinity;
    for (const {score} of this.props.nodes) {
      if (score > this._maxScore) {
        this._maxScore = score;
      }
    }
  }

  _color(d: VisualizerNode) {
    const scoreRatio = d.score / this._maxScore;
    return d3.interpolate(INTERPOLATE_LOW, INTERPOLATE_HIGH)(scoreRatio);
  }

  _radius(d: VisualizerNode) {
    // Use the square of the score as radius, so area will be proportional to score
    const v = Math.sqrt((d.score / this._maxScore) * MAX_SIZE_PIXELS) + 3;
    if (!isFinite(v)) {
      return 0;
    }
    return v;
  }

  _getSelectedEntity(): any {
    return this.props.selectedNode == null
      ? null
      : this.props.nodes.find((x) => x.address === this.props.selectedNode);
  }

  _setupScaffold() {
    this._svg = d3
      .select(this._rootNode)
      .append("svg")
      .style("flex-grow", 1);
    const rect = this._svg.node().getBoundingClientRect();
    this._chart = this._svg
      .append("g")
      .attr("transform", `translate(${rect.width / 2}, ${rect.height / 2})`);
    this._tooltip = d3
      .select(this._rootNode)
      .append("div")
      .attr("class", "toolTip")
      .style("display", "none")
      .style("position", "absolute")
      .style("color", "white")
      .style("min-width", "50px")
      .style("padding", "5px")
      .style("border", "1px solid")
      .style("border-radius", "2px")
      .style("height", "auto")
      .style("background-color", "#313131");

    this._edgesG = this._chart.append("g");
    this._selectedNodeHalo = this._chart.append("g");
    this._selectedNeighborHalo = this._chart.append("g");
    this._nodesG = this._chart.append("g");
    this._textG = this._chart.append("g");

    const that = this;
    this._mouseOver = function() {
      var data = d3.select(this).data()[0];

      that._tooltip
        .style("left", d3.event.pageX + 40 + "px")
        .style("top", d3.event.pageY + "px")
        .style("display", "inline-block")
        .style("border-color", that._color(data))
        .html(() => {
          return `${data.type}: ${data.description}`;
        });
    };

    this._mouseOff = () => {
      this._tooltip.style("display", "none");
    };

    this._ticked = () => {
      this._nodesG
        .selectAll(".node")
        .attr("cx", (d) => {
          return d.x;
        })
        .attr("cy", (d) => {
          return d.y;
        });

      const selectedEntity = this._getSelectedEntity();
      this._selectedNodeHalo
        .selectAll(".halo")
        // The hack is strong with this one!!
        .attr("cx", selectedEntity ? (selectedEntity: any).x : 0)
        .attr("cy", selectedEntity ? (selectedEntity: any).y : 0);

      this._selectedNeighborHalo
        .selectAll(".halo-neighbor")
        // The hack is strong with this one!!
        .attr("cx", (d) => d.x)
        .attr("cy", (d) => d.y);

      this._textG
        .selectAll(".text")
        .attr("x", (d) => {
          return d.x + this._radius(d) + 5;
        })
        .attr("y", (d) => {
          return d.y + 5;
        });

      //TODO: fix arrow marker by moving back based on the node radius
      this._edgesG
        .selectAll(".edge")
        .attr("x1", (d) => {
          return d.source.x;
        })
        .attr("y1", (d) => {
          return d.source.y;
        })
        .attr("x2", (d) => {
          return d.target.x;
        })
        .attr("y2", (d) => {
          return d.target.y;
        });
    };

    this.linkForce = d3
      .forceLink()
      .id((d) => d.address)
      .distance(120);
    this.simulation = d3
      .forceSimulation()
      .force("charge", d3.forceManyBody().strength(-380))
      .force("link", this.linkForce)
      .force(
        "collide",
        d3.forceCollide().radius((d) => {
          return this._radius(d) * 2;
        })
      )
      .force("x", d3.forceX())
      .force("y", d3.forceY())
      .alphaTarget(0.02)
      .alphaMin(0.01)
      .on("tick", this._ticked);
  }

  _updateSelectedHalo() {
    // hello mr. hack
    const selectedEntity = this._getSelectedEntity();
    const data = this.props.selectedNode == null ? [] : [1, 2, 3];
    const haloSelection = this._selectedNodeHalo.selectAll(".halo").data(data);
    haloSelection
      .exit()
      .transition()
      .ease(d3.easeQuad)
      .duration(1000)
      .remove();

    const newNodes = haloSelection
      .enter()
      .append("circle")
      .attr("class", "halo");

    haloSelection
      .merge(newNodes)
      .attr("stroke", HALO_COLOR)
      .attr("cx", selectedEntity ? selectedEntity.x : 0)
      .attr("cy", selectedEntity ? selectedEntity.y : 0)
      .attr("stroke-width", 1)
      .attr("opacity", (d) => 1 / (2 * d))
      .attr("fill", "none")
      .attr("r", 0)
      .transition()
      .ease(d3.easeQuad)
      .duration(500)
      .attr(
        "r",
        (d) => (selectedEntity ? this._radius(selectedEntity) + 2 + d * d : 0)
      );
  }

  _updateSelectedNeighborHalo(links: any) {
    const selectedNeighbors = [];
    const seenNeighborAddresses = new Set();
    if (this.props.selectedNode != null) {
      const snAddr = this.props.selectedNode;
      for (const {source, target} of links) {
        let neighbor = null;
        if (snAddr === source.address) {
          neighbor = target;
        }
        if (snAddr === target.address) {
          neighbor = source;
        }
        if (
          neighbor != null &&
          !seenNeighborAddresses.has(neighbor.address) &&
          snAddr !== neighbor
        ) {
          seenNeighborAddresses.add(neighbor.address);
          selectedNeighbors.push(neighbor);
        }
      }
    }
    const haloNeighborSelection = this._selectedNeighborHalo
      .selectAll(".halo-neighbor")
      .data(selectedNeighbors, (x) => x.address);
    haloNeighborSelection.exit().remove();

    const newNodes = haloNeighborSelection
      .enter()
      .append("circle")
      .attr("class", "halo-neighbor");

    haloNeighborSelection
      .merge(newNodes)
      .attr("stroke", HALO_COLOR)
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .attr("stroke-width", 1)
      .attr("opacity", 1 / 2)
      .attr("fill", "none")
      .attr("r", 0)
      .transition()
      .ease(d3.easeQuad)
      .duration(500)
      .attr("r", (d) => this._radius(d) + 3);
  }

  _fixSize() {
    const rect = this._svg.node().getBoundingClientRect();
    this._chart.attr(
      "transform",
      `translate(${rect.width / 2}, ${rect.height / 2})`
    );
  }

  _updateD3() {
    this._fixSize();
    this._computeMax();
    const links = this.props.edges.map((e) => ({
      source: e.src,
      target: e.dst,
      address: e.address,
    }));

    this.simulation.nodes(this.props.nodes);
    this.linkForce.links(links);

    console.log("About to update nodes.");

    // There surely must be a better way to do this.
    const existingNodes = this._nodesG.selectAll(".node").data();
    for (const node of this.props.nodes) {
      for (const en of existingNodes) {
        if (node.address === en.address) {
          node.x = en.x;
          node.y = en.y;
          node.vx = en.vx;
          node.vy = en.vy;
        }
      }
    }

    const nodeSelection = this._nodesG
      .selectAll(".node")
      .data(this.props.nodes, (x) => x.address);
    nodeSelection
      .exit()
      .transition()
      .ease(d3.easeQuad)
      .duration(1000)
      .remove();
    const newNodes = nodeSelection
      .enter()
      .append("circle")
      .attr("class", "node")
      .on("mouseover", this._mouseOver)
      .on("mouseout", this._mouseOff)
      .on("click", (d) => {
        this.props.onSelect(d.address);
      });

    nodeSelection
      .merge(newNodes)
      .transition()
      .ease(d3.easeQuad)
      .duration(1000)
      .attr("fill", this._color.bind(this))
      .attr("r", this._radius.bind(this));

    const textSelection = this._textG
      .selectAll(".text")
      .data(this.props.nodes, (x) => x.address);
    textSelection
      .exit()
      .transition()
      .ease(d3.easeQuad)
      .duration(1000)
      .remove();
    const newTexts = textSelection
      .enter()
      .append("text")
      .attr("class", "text");

    textSelection
      .merge(newTexts)
      .transition()
      .ease(d3.easeQuad)
      .duration(1000)
      .text((d) => {
        return Math.floor(d.score * 10000);
      })
      .attr("fill", this._color.bind(this))
      .attr("font-size", 14);

    // edge data join
    var edge = this._edgesG.selectAll(".edge").data(links, (x) => x.address);

    // edge exit
    edge.exit().remove();

    // edge enter
    var newEdge = edge
      .enter()
      .append("line")
      .attr("class", "edge");

    edge
      .merge(newEdge)
      .transition()
      .ease(d3.easeQuad)
      .duration(1000)
      .attr("marker-end", "url(#arrow)")
      .attr("stroke-width", () => {
        return "1px";
      })
      .attr("opacity", "0.4")
      .attr("stroke", (d) => {
        const sn = this.props.selectedNode;
        if (sn) {
          if (d.source.address === sn || d.target.address === sn) {
            return HALO_COLOR;
          }
        }
        return EDGE_COLOR;
      });

    this._updateSelectedHalo();
    this._updateSelectedNeighborHalo(links);
    if (!(window: any).stopSimulation) {
      this.simulation.restart();
      this.simulation.alpha(0.3);
    } else {
      this.simulation.stop();
    }
    this._ticked();
  }

  componentDidMount() {
    this._setupScaffold();
    this._updateD3();
    setTimeout(() => this._fixSize(), 1);
  }

  componentDidUpdate() {
    this._updateD3();
  }

  _setRef(componentNode: HTMLDivElement | null) {
    this._rootNode = componentNode;
  }

  render() {
    return (
      <div
        style={{
          backgroundColor: BACKGROUND_COLOR,
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
        }}
        className="graph-container"
        ref={this._setRef.bind(this)}
      />
    );
  }
}
