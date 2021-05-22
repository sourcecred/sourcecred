---
sourcecred: a social algorithm for computing cred
---

> This workguide walks a user through: cloning the [sourcecred](https://github.com/sourcecred/sourcecred) and [template-instance](https://github.com/sourcecred/template-instance) repositories,
> installing dependencies and setting up a development environment.

# Setting up a Source Cred Development Environment

## Building SourceCred Locally

**First, run the following commands to clone and build SourceCred:**

```sh
git clone https://github.com/sourcecred/sourcecred.git
cd sourcecred
yarn
yarn build
```

## SourceCred Instance Setup and Usage

**Next, run the following commands to clone the sourcecred template instance:**

```sh
git clone https://github.com/sourcecred/template-instance.git
cd template-instance
```

Using this instance as a starting point, you can update the config to include
the plugins you want, pointing at the data you care about. We recommend setting
up your instance locally first and make sure its working before pushing your
changes to master and using the Github Action.

1. Get [Yarn] and then run `yarn` to install SourceCred and dependencies.

2. Enable the plugins you want to use by updating the `sourcecred.json` file.
   e.g. to enable all the plugins:

```json
{
  "bundledPlugins": [
    "sourcecred/discourse",
    "sourcecred/discord",
    "sourcecred/github"
  ]
}
```

3. If you are using the GitHub or Discord plugin, copy the `.env.example` file
   to a `.env` file:

```shell script
cp .env.example .env
```

4. Follow the steps in the [plugin guides below](#supported-plugins) to setup
   the config files and generate access tokens for each plugin and then paste
   them into the `.env` file after the `=` sign.

**Using A Modified Backend**

You'll likely want to test out your modified version of SourceCred on an
instance you're familiar with.

A convenient way to do that is to create an alias for your altered version of
SourceCred.

Here's an example of how to do so in a bash shell:

```sh
# While in the SourceCred directory reopsitory
SC_REPOSITORY_DIR=`pwd`
alias scdev='node "$SC_REPOSITORY_DIR"/bin/sourcecred.js'

# Then go back to the Template Instance directory, for example:
cd $MY_SC_INSTANCE
# Run the `sourcecred go` command, in your instance, using your modified code.
scdev go
```

5. Initialize the configs a. change
   https://github.com/sourcecred/template-instance/blob/master/config/grain.json#L2
   to be non-zero b. change
   https://github.com/sourcecred/template-instance/blob/master/sourcecred.json#L2
   to be ["sourcecred/discourse"]

6. from your local template-instance clone, run `scdev go`
7. run `scdev serve` go to the url it outputs.

## Supported Plugins

**GitHub**

The GitHub plugin loads GitHub repositories.

You can specify the repositories to load in
`config/plugins/sourcecred/github/config.json`.

The Github Action automatically has its own GITHUB_TOKEN, but if you need to
load data from the GitHub plugin locally, you must have a GitHub API key in your
`.env` file as `SOURCECRED_GITHUB_TOKEN=<token>` (copy the `.env.example` file
for reference). The key should be read-only without any special scopes or
permissions (unless you are loading a private GitHub repository, in which case
the key needs access to your private repositories).

You can generate a GitHub API key [here](https://github.com/settings/tokens).

## Discourse

The Discourse plugin loads Discourse forums; currently, only one forum can be
loaded in any single instance. This does not require any special API keys or
permissions. You just need to set the server url in
`config/plugins/sourcecred/discourse/config.json`.

## Discord

The Discord plugin loads Discord servers, and mints Cred on Discord reactions.
In order for SourceCred to access your Discord server, you need to generate a
"bot token" and paste it in the `.env` file as
`SOURCECRED_DISCORD_TOKEN=<token>` (copy the `.env.example` file for reference).
You will also need to add it to your GitHub Action secrets.

The full instructions for setting up the Discord plugin can be found in the
[Discord plugin page](https://sourcecred.io/docs/beta/plugins/discord/#configuration)
in the SourceCred documentation.

Removing plugins

## Removing plugins

To deactivate a plugin, just remove it from the `bundledPlugins` array in the
`sourcecred.json` file. You can also remove its `config/plugins/OWNER/NAME`
directory for good measure.

[yarn]: https://classic.yarnpkg.com/
