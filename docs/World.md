<a name="World"></a>

## World

Simple world with a self-contained clock, treated consistently across
calls to `now` and `sleepMs`, and a customizable, deterministic
jitter function. The jitter function is defined by an infinite
sequence of uniform variates (i.e., reals in `[0.0, 1.0]`) that
determine how much jitter to apply (`0.0` = none, `1.0` = full).
A finite prefix of the uniform variate sequence is given to the
constructor; all subsequent elements are `0.0`.

**Kind**: global class
