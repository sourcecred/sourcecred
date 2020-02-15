import {fetchDiscord} from "../plugins/discord/fetch";

const discord = (_unused_args, _unused_std) => {
  fetchDiscord();
};

export default discord;
