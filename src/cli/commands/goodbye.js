// @flow
import {Command, flags} from "@oclif/command";

export default class GoodbyeCommand extends Command {
  static description = "Another example command description";
  static flags = {
    name: flags.string({char: "n", description: "name to print"}),
  };
  async run() {
    const {flags} = this.parse(GoodbyeCommand);
    const name = flags.name || "world";
    this.log(`goodbye ${name}`);
  }
}
