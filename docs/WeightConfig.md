<a name="WeightConfig"></a>

## WeightConfig

A React component that lets users set Type-level weights.

The WeightConfig component renders a slider for every ReactNode and Edge type
within the array of declarations it's been provided. The sliders are
organized by plugin at the top level, and then by whether they represent
node or edge types at the level beneath.

Each slider displays the weight associated in the `nodeWeights` or
`edgeWeights` maps provided in props. When the user changes the weight,
`onNodeWeightChange` or `onEdgeWeightChange` is called with the new weight.

**Kind**: global class
