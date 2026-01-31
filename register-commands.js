const { REST, Routes, SlashCommandBuilder } = require("discord.js");
const { config } = require("./config");

const createCommands = () => {
  return [
    new SlashCommandBuilder()
      .setName("cta")
      .setDescription("Create a CTA event")
      .addStringOption((option) =>
        option
          .setName("event")
          .setDescription("Event type (e.g. CW1)")
          .setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName("duration")
          .setDescription("Duration in minutes (default 3)")
          .setRequired(false)
      ),
    new SlashCommandBuilder()
      .setName("list_events")
      .setDescription("List all events and their points"),
    new SlashCommandBuilder()
      .setName("set_event")
      .setDescription("Create or update an event type")
      .addStringOption((option) =>
        option
          .setName("event")
          .setDescription("Event type name")
          .setRequired(true)
      )
      .addIntegerOption((option) =>
        option.setName("points").setDescription("Points").setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("points")
      .setDescription("Show points")
      .addStringOption((option) =>
        option
          .setName("scope")
          .setDescription("Use 'all' to show all users")
          .addChoices({ name: "all", value: "all" })
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName("ign")
          .setDescription("Check another user by IGN")
          .setRequired(false)
      ),
    new SlashCommandBuilder()
      .setName("leaderboard")
      .setDescription("Show top 20 users by points"),
    new SlashCommandBuilder()
      .setName("register")
      .setDescription("Register your IGN and class")
      .addStringOption((option) =>
        option
          .setName("ign")
          .setDescription("In-game name")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("class")
          .setDescription("Class")
          .addChoices(
            { name: "MELEE", value: "MELEE" },
            { name: "MAGE", value: "MAGE" },
            { name: "RANGER", value: "RANGER" },
            { name: "SPEC", value: "SPEC" }
          )
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("profile")
      .setDescription("Show your registered profile"),
    new SlashCommandBuilder()
      .setName("reset_points")
      .setDescription("Reset points (Senate only)")
      .addStringOption((option) =>
        option
          .setName("scope")
          .setDescription("Use 'all' to reset everyone")
          .addChoices({ name: "all", value: "all" })
          .setRequired(false)
      )
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("Reset a specific user")
          .setRequired(false)
      ),
    new SlashCommandBuilder()
      .setName("export_points")
      .setDescription("Export all points to CSV (Senate only)"),
    new SlashCommandBuilder()
      .setName("audit_log")
      .setDescription("View Senate action log (Senate only)")
  ];
};

const registerCommands = async () => {
  if (!config.token || !config.clientId || !config.guildId) {
    console.error("Missing DISCORD_TOKEN, CLIENT_ID, or GUILD_ID in .env");
    process.exit(1);
  }

  const rest = new REST({ version: "10" }).setToken(config.token);
  const commands = createCommands().map((cmd) => cmd.toJSON());

  try {
    await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
      body: commands
    });
    console.log("Slash commands registered.");
  } catch (error) {
    console.error("Failed to register commands:", error);
  }
};

registerCommands();
