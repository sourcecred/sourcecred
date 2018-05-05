// @flow
import {Command, flags} from "@oclif/command";

export default class ExampleCommand extends Command {
  static description = "An example command description";
  static flags = {
    name: flags.string({char: "n", description: "name to print"}),
  };
  async run() {
    const {flags} = this.parse(ExampleCommand);
    const name = flags.name || "world";
    this.log(`hello ${name} EXAMPEL`);
  }
}
