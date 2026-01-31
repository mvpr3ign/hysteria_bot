const { REST, Routes, SlashCommandBuilder } = require("discord.js");
const { config } = require("./config");
const { getStore } = require("./store");

const createEventChoices = () => {
  const store = getStore();
  const eventNames = Object.keys(store.eventPoints || {})
    .map((name) => name.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const limited = eventNames.slice(0, 24);
  const choices = limited.map((name) => ({ name, value: name }));
  choices.push({ name: "OTHERS", value: "OTHERS" });
  return choices;
};

const createRegistrantChoices = () => {
  const store = getStore();
  const names = Object.values(store.attendance || {})
    .map((entry) => entry?.profile?.nickname || entry?.profile?.name || entry?.profile?.tag)
    .filter(Boolean);
  const unique = Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  return unique.slice(0, 25).map((name) => ({ name, value: name }));
};

const createCommands = () => {
  const eventChoices = createEventChoices();
  const registrantChoices = createRegistrantChoices();
  return [
    new SlashCommandBuilder()
      .setName("cta")
      .setDescription("Create a CTA event")
      .addStringOption((option) =>
        option
          .setName("event")
          .setDescription("Event type (e.g. CW1)")
          .addChoices(...eventChoices)
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("description")
          .setDescription("Required if event is OTHERS")
          .setRequired(false)
      )
      .addIntegerOption((option) =>
        option
          .setName("points")
          .setDescription("Required if event is OTHERS")
          .setRequired(false)
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
      .setName("cta_attendance")
      .setDescription("View CTA attendance by event and date (Senate only)")
      .addStringOption((option) =>
        option
          .setName("event")
          .setDescription("Event type (e.g. CW1)")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("date")
          .setDescription("MM-DD-YY (Philippine time)")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("timestamp")
          .setDescription("Select a timestamp from the list")
          .setAutocomplete(true)
          .setRequired(false)
      ),
    new SlashCommandBuilder()
      .setName("end")
      .setDescription("End the active CTA in this channel (Senate only)"),
    new SlashCommandBuilder()
      .setName("addpoints")
      .setDescription("Add points to a registered member (Senate only)")
      .addStringOption((option) =>
        option
          .setName("nickname")
          .setDescription("Discord nickname of the member")
          .addChoices(...registrantChoices)
          .setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName("points")
          .setDescription("Points to add")
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("addpoints_batch")
      .setDescription("Add points in bulk via TXT file (Senate only)")
      .addAttachmentOption((option) =>
        option
          .setName("file")
          .setDescription("TXT file with lines: IGN,points")
          .setRequired(true)
      ),
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
      .addStringOption((option) =>
        option
          .setName("date")
          .setDescription("MM-DD-YY (Philippine time)")
          .setRequired(false)
      )
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
