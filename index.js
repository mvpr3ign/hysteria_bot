const {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  GatewayIntentBits,
  InteractionType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");
const { config } = require("./config");
const { getStore, updateStore } = require("./store");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const normalizeEventName = (value) => {
  if (!value) return "";
  return value.toUpperCase().replace(/\s+/g, "");
};

const formatDate = (date) => {
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric"
  }).format(date);
};

const formatTimestamp = (date) => {
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
};

const generateCode = (length = 4) => {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const alphaNumeric = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const alphaCount = Math.min(3, Math.max(2, length - 1));
  let code = "";

  for (let i = 0; i < alphaCount; i += 1) {
    code += letters[Math.floor(Math.random() * letters.length)];
  }

  while (code.length < length - 1) {
    code += letters[Math.floor(Math.random() * letters.length)];
  }

  code += alphaNumeric[Math.floor(Math.random() * alphaNumeric.length)];
  return code;
};

const isExpired = (expiresAt) => Date.now() >= expiresAt;

const scheduleCtaClose = (channelId, expiresAt) => {
  const delay = Math.max(0, expiresAt - Date.now());
  setTimeout(() => handleCtaExpiration(channelId), delay);
};

const handleCtaExpiration = async (channelId) => {
  const store = getStore();
  const cta = store.activeCtas[channelId];
  if (!cta) return;

  if (!isExpired(cta.expiresAt)) {
    scheduleCtaClose(channelId, cta.expiresAt);
    return;
  }

  await closeCta(channelId, cta);
};

const closeCta = async (channelId, cta) => {
  updateStore((store) => {
    delete store.activeCtas[channelId];
    return store;
  });

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) return;

    if (cta.messageId) {
      const message = await channel.messages.fetch(cta.messageId);
      if (message) {
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("cta:closed")
            .setLabel("Enter Code")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        );
        await message.edit({ components: [disabledRow] });
      }
    }

    await channel.send("Event registration has closed.");
  } catch (error) {
    console.error("Failed to close CTA:", error);
  }
};

const ensureSenate = (interaction) => {
  if (!config.senateRoleId) return false;
  return interaction.member.roles.cache.has(config.senateRoleId);
};

const appendAuditLog = (action, interaction, details) => {
  updateStore((store) => {
    store.auditLog.push({
      action,
      performedBy: interaction.user.id,
      performedByName: interaction.user.tag,
      timestamp: new Date().toISOString(),
      details
    });
    return store;
  });
};

const getRankForUser = (attendance, userId) => {
  const sorted = Object.entries(attendance).sort(
    (a, b) => (b[1]?.totalPoints || 0) - (a[1]?.totalPoints || 0)
  );
  const index = sorted.findIndex(([id]) => id === userId);
  return index === -1 ? null : index + 1;
};

const buildPointsList = (attendance, limit = 200) => {
  const entries = Object.entries(attendance)
    .map(([userId, data]) => ({
      userId,
      name: data?.profile?.name || data?.profile?.tag || userId,
      points: data?.totalPoints || 0
    }))
    .sort((a, b) => b.points - a.points);

  const lines = [];
  for (const entry of entries) {
    lines.push(`${entry.name} - ${entry.points}`);
    if (lines.length >= limit) break;
  }

  return { lines, total: entries.length };
};

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
  const store = getStore();
  Object.entries(store.activeCtas).forEach(([channelId, cta]) => {
    if (isExpired(cta.expiresAt)) {
      handleCtaExpiration(channelId);
    } else {
      scheduleCtaClose(channelId, cta.expiresAt);
    }
  });
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const store = getStore();

    if (interaction.commandName === "cta") {
      const eventInput = interaction.options.getString("event", true);
      const normalizedEvent = normalizeEventName(eventInput);
      const points = store.eventPoints[normalizedEvent];
      if (!points) {
        await interaction.reply({
          content: `Unknown event "${normalizedEvent}". Use /set_event to add it.`,
          ephemeral: true
        });
        return;
      }

      const durationInput = interaction.options.getInteger("duration");
      const duration = durationInput && durationInput > 0 ? durationInput : config.defaultCtaMinutes;
      const channelId = interaction.channelId;
      const existing = store.activeCtas[channelId];

      if (existing && !isExpired(existing.expiresAt)) {
        await interaction.reply({
          content: "A CTA is already running in this channel.",
          ephemeral: true
        });
        return;
      }

      const code = generateCode(config.codeLength);
      const expiresAt = Date.now() + duration * 60 * 1000;

      const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`cta:enter:${channelId}`)
          .setLabel("Enter Code")
          .setStyle(ButtonStyle.Primary)
      );

      const message = await interaction.reply({
        content: `Code: ${code}\nEvent: ${normalizedEvent}, ${points} points\nDuration: ${duration} minutes`,
        components: [buttonRow],
        fetchReply: true
      });

      updateStore((next) => {
        next.activeCtas[channelId] = {
          code,
          eventType: normalizedEvent,
          points,
          expiresAt,
          createdBy: interaction.user.id,
          createdAt: Date.now(),
          attendees: [],
          messageId: message.id,
          guildId: interaction.guildId
        };
        return next;
      });

      scheduleCtaClose(channelId, expiresAt);
      return;
    }

    if (interaction.commandName === "list_events") {
      const lines = Object.entries(store.eventPoints)
        .map(([name, value]) => `${name} = ${value} pts`)
        .join("\n");

      await interaction.reply({
        content: lines.length ? lines : "No events set.",
        ephemeral: true
      });
      return;
    }

    if (interaction.commandName === "set_event") {
      if (!ensureSenate(interaction)) {
        await interaction.reply({
          content: "You do not have permission to use this command.",
          ephemeral: true
        });
        return;
      }

      const eventInput = interaction.options.getString("event", true);
      const normalizedEvent = normalizeEventName(eventInput);
      const points = interaction.options.getInteger("points", true);

      updateStore((next) => {
        next.eventPoints[normalizedEvent] = points;
        return next;
      });

      await interaction.reply({
        content: `${normalizedEvent} event has been assigned ${points} points!`,
        ephemeral: true
      });
      return;
    }

    if (interaction.commandName === "points") {
      const scope = interaction.options.getString("scope");
      const targetUser = interaction.options.getUser("user");

      if (scope === "all") {
        const { lines, total } = buildPointsList(store.attendance);
        const content = lines.length ? lines.join("\n") : "No points recorded yet.";
        const suffix = total > lines.length ? `\n...and ${total - lines.length} more.` : "";
        await interaction.reply({
          content: content + suffix,
          ephemeral: true
        });
        return;
      }

      const userId = targetUser?.id || interaction.user.id;
      const record = store.attendance[userId];
      const points = record?.totalPoints || 0;
      const rank = getRankForUser(store.attendance, userId);

      if (userId === interaction.user.id) {
        await interaction.reply({
          content: `Your current points = ${points}\nYour current rank = ${rank || "N/A"}`,
          ephemeral: true
        });
        return;
      }

      await interaction.reply({
        content: `Points for ${targetUser?.tag || userId} = ${points}\nRank = ${rank || "N/A"}`,
        ephemeral: true
      });
      return;
    }

    if (interaction.commandName === "leaderboard") {
      const entries = Object.entries(store.attendance)
        .map(([userId, data]) => ({
          userId,
          name: data?.profile?.name || data?.profile?.tag || userId,
          points: data?.totalPoints || 0
        }))
        .sort((a, b) => b.points - a.points)
        .slice(0, 20);

      const lines = entries.map(
        (entry, index) => `${index + 1}. ${entry.name} - ${entry.points}`
      );

      await interaction.reply({
        content: lines.length ? lines.join("\n") : "No points recorded yet.",
        ephemeral: true
      });
      return;
    }

    if (interaction.commandName === "register") {
      const ignInput = interaction.options.getString("ign", true).trim();
      const classInput = interaction.options.getString("class", true).trim();

      updateStore((next) => {
        if (!next.attendance[interaction.user.id]) {
          next.attendance[interaction.user.id] = {
            totalPoints: 0,
            history: [],
            profile: {}
          };
        }

        const record = next.attendance[interaction.user.id];
        record.profile = {
          ...record.profile,
          name: interaction.user.username,
          tag: interaction.user.tag,
          ign: ignInput,
          class: classInput
        };

        return next;
      });

      await interaction.reply({
        content: `Registration saved. IGN: ${ignInput}, Class: ${classInput}`,
        ephemeral: true
      });
      return;
    }

    if (interaction.commandName === "reset_points") {
      if (!ensureSenate(interaction)) {
        await interaction.reply({
          content: "You do not have permission to use this command.",
          ephemeral: true
        });
        return;
      }

      const scope = interaction.options.getString("scope");
      const targetUser = interaction.options.getUser("user");

      if (scope === "all") {
        updateStore((next) => {
          next.attendance = {};
          return next;
        });

        appendAuditLog("reset_all", interaction, "All points reset");

        await interaction.reply({
          content: "All points have been reset.",
          ephemeral: true
        });
        return;
      }

      if (!targetUser) {
        await interaction.reply({
          content: "Provide a user or use scope=all.",
          ephemeral: true
        });
        return;
      }

      updateStore((next) => {
        delete next.attendance[targetUser.id];
        return next;
      });

      appendAuditLog("reset_user", interaction, `Reset points for ${targetUser.id}`);

      await interaction.reply({
        content: `Points for ${targetUser.tag} have been reset.`,
        ephemeral: true
      });
      return;
    }

    if (interaction.commandName === "export_points") {
      if (!ensureSenate(interaction)) {
        await interaction.reply({
          content: "You do not have permission to use this command.",
          ephemeral: true
        });
        return;
      }

      const rows = [
        "userId,username,ign,class,totalPoints,lastEvent,lastTimestamp"
      ];
      Object.entries(store.attendance).forEach(([userId, data]) => {
        const last = data.history?.[data.history.length - 1];
        const username = data?.profile?.name || data?.profile?.tag || "";
        const ign = data?.profile?.ign || "";
        const className = data?.profile?.class || "";
        const lastEvent = last?.eventType || "";
        const lastTimestamp = last?.timestamp || "";
        rows.push(
          `${userId},${username},${ign},${className},${data.totalPoints || 0},${lastEvent},${lastTimestamp}`
        );
      });

      const csv = rows.join("\n");
      const file = new AttachmentBuilder(Buffer.from(csv, "utf-8"), {
        name: "points-export.csv"
      });

      appendAuditLog("export_points", interaction, "Exported points CSV");

      await interaction.reply({
        content: "CSV export ready.",
        files: [file],
        ephemeral: true
      });
      return;
    }

    if (interaction.commandName === "audit_log") {
      if (!ensureSenate(interaction)) {
        await interaction.reply({
          content: "You do not have permission to use this command.",
          ephemeral: true
        });
        return;
      }

      const entries = store.auditLog.map((entry) => {
        return `${entry.timestamp} - ${entry.action} by ${entry.performedByName} (${entry.performedBy}) - ${entry.details}`;
      });

      const logText = entries.join("\n");
      if (logText.length <= 1800) {
        await interaction.reply({
          content: logText.length ? logText : "No audit log entries yet.",
          ephemeral: true
        });
        return;
      }

      const file = new AttachmentBuilder(Buffer.from(logText, "utf-8"), {
        name: "audit-log.txt"
      });

      await interaction.reply({
        content: "Audit log attached.",
        files: [file],
        ephemeral: true
      });
      return;
    }
  }

  if (interaction.isButton()) {
    if (!interaction.customId.startsWith("cta:enter:")) return;
    const channelId = interaction.customId.split(":")[2];
    const store = getStore();
    const cta = store.activeCtas[channelId];

    if (!cta || isExpired(cta.expiresAt)) {
      await interaction.reply({
        content: "This CTA is no longer active.",
        ephemeral: true
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`cta:code:${channelId}`)
      .setTitle("Enter CTA Code");

    const codeInput = new TextInputBuilder()
      .setCustomId("cta_code")
      .setLabel("CTA Code")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(10);

    const row = new ActionRowBuilder().addComponents(codeInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
    return;
  }

  if (interaction.type === InteractionType.ModalSubmit) {
    if (!interaction.customId.startsWith("cta:code:")) return;
    const channelId = interaction.customId.split(":")[2];
    const store = getStore();
    const cta = store.activeCtas[channelId];

    if (!cta || isExpired(cta.expiresAt)) {
      await interaction.reply({
        content: "This CTA is no longer active.",
        ephemeral: true
      });
      return;
    }

    const registeredRecord = store.attendance[interaction.user.id];
    const registeredProfile = registeredRecord?.profile || {};
    if (!registeredProfile.ign || !registeredProfile.class) {
      await interaction.reply({
        content:
          "You are not a registered member of Hysteria Guild. Please register using /register <IGN> <CLASS>",
        ephemeral: true
      });
      return;
    }

    const inputCode = interaction.fields.getTextInputValue("cta_code").trim().toUpperCase();
    if (inputCode !== cta.code) {
      await interaction.reply({
        content: "Invalid code.",
        ephemeral: true
      });
      return;
    }

    if (cta.attendees.includes(interaction.user.id)) {
      await interaction.reply({
        content: "You have already joined this CTA.",
        ephemeral: true
      });
      return;
    }

    const now = new Date();
    const dateLabel = formatDate(now);
    const timestamp = formatTimestamp(now);

    updateStore((next) => {
      const updatedCta = next.activeCtas[channelId];
      if (updatedCta) {
        updatedCta.attendees.push(interaction.user.id);
      }

      if (!next.attendance[interaction.user.id]) {
        next.attendance[interaction.user.id] = {
          totalPoints: 0,
          history: [],
          profile: {}
        };
      }

      const record = next.attendance[interaction.user.id];
      record.totalPoints += cta.points;
      record.history.push({
        eventType: cta.eventType,
        points: cta.points,
        date: dateLabel,
        timestamp,
        code: cta.code,
        channelId,
        guildId: interaction.guildId
      });
      record.profile = {
        name: interaction.user.username,
        tag: interaction.user.tag
      };

      return next;
    });

    await interaction.reply({
      content: `Your attendance for ${cta.eventType} - ${dateLabel}, has been recorded on ${timestamp}!`,
      ephemeral: true
    });
  }
});

if (!config.token) {
  console.error("Missing DISCORD_TOKEN in .env");
  process.exit(1);
}

client.login(config.token);
