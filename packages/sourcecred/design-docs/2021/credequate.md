
Original PR with prototype code and feedback can be found here:
https://github.com/sourcecred/sourcecred/pull/3232


# Description
The above linked PR is a sketch for a simple arithmetic-based scoring algorithm that could provide an alternative to pagerank. It does not use a cyclic graph, and instead uses a **list of contributions** that have **equations** for weight combination, acting more like a tree data structure with extensibility to act like a directed acyclic graph. The equation type is recursive, and can be used to represent rather complex weight equations such as the example discord message equation:
```
channelWeight * ((emojiWeight1 * roleWeight1) + ... + (emojiWeightN * roleWeightN))
```

# Benefits:

### Memory efficient / scalable
Contributions can be scored one by one, making it much more memory efficient to do all scoring in memory, and also opening up additional memory optimization opportunities involving simple read and write streams, and partial re-scores.

### Intuitively Configure Weights
Configuring weights is one of the large points of friction for setting up a new instance, because of the ambiguity on how weights will change the results. With this model, plugins will have consistent equations that make it easy to understand how a weight change will be factored into the scores.

### Improved In-memory Simulation
This allows more complex weighting logic to be included in the browser-friendly scoring step, meaning that we can shift most of the configuration out of the disk-based "graphing" step. This will allow us to offer AWESOME simulation tools that makes it super easy for end-users to run their own simulations and propose changes to most of the important configurations.

### Contribution-level analytics / End-user accessibility
Right now, it is super difficult to reason about where a participant's cred score is coming from and about where a contribution's score is coming from. This let's our analytic tools go beyond "how much cred does each person have," letting end-users easily audit the end-to-end flow of cred through contributions.

### Composability / Potential for more complex inter-plugin and inter-instance logic
Right now, inter-plugin logic is difficult and wonky, and inter-instance logic is pretty much out of the question. This new model will allow us to use similar "equation" configuration to add additional layers of score aggregation across plugins, and even across instances!

### Accessibility for Devs (1st and 3rd party)
It is difficult to onboard to both our core code and our 3rd-party library because both generally require intimate knowledge of the CredRank algorithm. This new model will make it SUPER easy for new devs to onboard to our team or start building advanced integrations.

### Powerful plugin creation out-of-the-box
The discord plugin is our most nuanced, but only because it has a bunch of hacky logic that breaks the intended architecture. This new model prioritizes and creates structure for embedding the nuance that has proven to be so desirable (as shown by the constant requests for additional weight configuration types on categories, tags, repos, etc). This means that advanced plugin creation will be more accessible and faster. This model additionally has GREAT potential for developers to define a schema that our utilities then use to generate builders, parsers, validators, declarations, and default configurations, further optimizing plugin creation.

### Extensible
I only included support for ADD and MULTIPLY but this could easily be extended to include operations such as MAX, MIN, OR_ELSE, AVERAGE. And any such extensions would then be immediately available for all plugins to integrate!!!

### Can be supported in parallel with CredRank
We can create two different CLI paths for CredRank and Contributions, allowing some instances to keep using CredRank while others experiment with this new model. If the new model is as successful as I suspect, we can the discuss deprecating CredRank.

### It's basically done
This PR includes most of the heavy lifting / design required. The only things left would be some data piping through new CLI commands, and converting each plugin (one at a time) to support the new scoring path.

# Downsides:
Honestly, I'm having a hard time thinking of any. Maybe there are some future analytics that we haven't built yet (and have no plans to build) that would benefit from a graph model? Maybe people understanding the algorithm better will mean gamers understanding how to game the algorithm better?

# Launch plan
A core algorithm change is a big deal, so we will be careful/ conservative in how we introduce it. This will initially be launched as its own CLI, an optional alternative to using the graph/credrank CLI. We will find some instances interested in converting to the new algorithm, or run parallel test instances, and see how it performs and is received by those beta testers. If it performs very well, we may consider discontinuing support for CredRank. This will be an ecosystem-wide discussion and we will strive for inclusivity in that choice.

# Test Plan
1. Remove all plugins except discord from sourcecred.json
1. `scdev graph && scdev credrank`

# Test Plan for 1st commit
from `packages/sourcecred` run `yarn shell`
```
$ sc.test.score(sc.test.exampleDiscordContribution, sc.test.exampleDiscordWeightConfig)
{
  id: '1234',
  plugin: 'Discord',
  type: 'Message',
  participants: [
    { id: 'ASDVERW342tFD', shares: 1 },
    { id: 'SD533FEfdsdrG', shares: 3 }
  ],
  equation: {
    type: 'MULTIPLY',
    description: 'contribution attributes',
    factors: [ [Object] ],
    equationFactors: [ [Object] ]
  },
  score: 6
}
```