const retry = require("retry");
const op = retry.operation({factor: 2, retries: 3, minTimeout: 1000});
const first = Date.now();
let last = first;
op.attempt((i) => {
  const now = Date.now();
  console.log(`attempt ${i}; delta: ${now - last} ms; 2^i = ${2**i}; total: ${now - first} ms`);
  last = now;
  op.retry(true);
});
