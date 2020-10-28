<a name="WeightSlider"></a>

## WeightSlider
The WeightSlider is a [controlled component] which lets the user choose a
numeric weight by dragging a slider.

The weight varies exponentially in the slider position, so that moving the
slider by one notch changes the weight by a power of two. The exception is
when the user drags the slider to its minimum value, in which case the
weight is set to 0.

In addition to rendering a slider (instantiated as a [range input]), it also renders
a description of the slider, and the weight associated with the current slider position.

Note that it is possible to configure the WeightSlider with a weight that
that is impossible to select via the slider; for example, 1/3. In such cases,
the WeightSlider's slider will be set to the closest possible position, and after
the user adjusts the weight via the slider, it will always correspond exactly to
the slider position.

[controlled component]: https://reactjs.org/docs/forms.html#controlled-components
[range input]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/range

**Kind**: global class  
