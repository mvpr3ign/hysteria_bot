const dotenv = require("dotenv");

dotenv.config();

const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  senateRoleId: process.env.SENATE_ROLE_ID,
  defaultCtaMinutes: 3,
  codeLength: 4
};

module.exports = { config };
