const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.error('TOKEN não configurado no Railway.');
  process.exit(1);
}

const dbFile = path.join(__dirname, 'data', 'store.json');
const backupDir = path.join(__dirname, 'data', 'backups');

fs.mkdirSync(path.dirname(dbFile), { recursive: true });
fs.mkdirSync(backupDir, { recursive: true });

let db = loadDB();
let saveTimer;

function loadDB() {
  try {
    if (fs.existsSync(dbFile)) {
      return JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    }

    return {
      version: 6,
      guilds: {}
    };
  } catch (error) {
    console.error('Falha ao ler banco:', error);

    return {
      version: 6,
      guilds: {}
    };
  }
}

function saveDB() {
  clearTimeout(saveTimer);

  saveTimer = setTimeout(() => {
    try {
      const tempFile = `${dbFile}.tmp`;

      fs.writeFileSync(
        tempFile,
        JSON.stringify(db, null, 2)
      );

      fs.renameSync(tempFile, dbFile);
    } catch (error) {
      console.error('Erro ao salvar banco:', error);
    }
  }, 150);
}

function saveNow() {
  try {
    fs.writeFileSync(
      dbFile,
      JSON.stringify(db, null, 2)
    );
  } catch (error) {
    console.error('Erro ao salvar banco:', error);
  }
}

function gid(guildId) {
  if (!db.guilds[guildId]) {
    db.guilds[guildId] = {
      settings: {
        staffRoleId: '',
        logsChannelId: '',
        ticketCategoryId: '',
        panelMessages: [],
        pix: '',
        deliveryMode: 'ticket',
        maintenance: false,
        feedbackEnabled: true,
        lowStockThreshold: 2
      },

      products: {},
      tickets: {},
      orders: {},
      sales: [],
      reviews: [],
      audit: [],

      counters: {
        order: 0,
        sale: 0
      }
    };
  }

  return db.guilds[guildId];
}

function idify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) || 'produto';
}

function money(value) {
  return `R$ ${Number(value).toFixed(2).replace('.', ',')}`;
}

function stamp() {
  return new Date().toISOString();
}

function nextId(prefix, counter) {
  counter++;

  return {
    id: `${prefix}-${String(counter).padStart(5, '0')}`,
    counter
  };
}

function audit(guildData, actor, action, details = '') {
  guildData.audit.unshift({
    at: stamp(),
    actorId: actor,
    action,
    details
  });

  guildData.audit = guildData.audit.slice(0, 500);

  saveDB();
}

function staff(interaction) {
  const guildData = gid(interaction.guildId);

  return Boolean(
    interaction.memberPermissions?.has('Administrator') ||
    (
      guildData.settings.staffRoleId &&
      interaction.member?.roles?.cache?.has(
        guildData.settings.staffRoleId
      )
    )
  );
}

async function staffOnly(interaction) {
  if (!staff(interaction)) {
    await interaction.reply({
      content: '❌ Apenas a staff pode usar este comando.',
      ephemeral: true
    });

    return false;
  }

  return true;
}

function product(guildData, name) {
  return (
    guildData.products[idify(name)] ||
    Object.values(guildData.products).find(
      p =>
        p.id === name ||
        p.name.toLowerCase() === String(name).toLowerCase()
    )
  );
}

function currentTicket(guildData, channelId) {
  return Object.values(guildData.tickets).find(
    ticket =>
      ticket.channelId === channelId &&
      ticket.status !== 'closed'
  );
}

function ticketUserId(channel, ticket) {
  return (
    ticket?.userId ||
    channel.permissionOverwrites.cache.find(
      overwrite =>
        overwrite.type === 1 &&
        overwrite.allow.has('ViewChannel')
    )?.id
  );
}

const {
  commands,
  handleCommand,
  handleButton,
  handleSelect,
  handleModal
} = require('./interactions');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

async function register(guild) {
  const rest = new REST({
    version: '10'
  }).setToken(TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(
      client.user.id,
      guild.id
    ),
    {
      body: commands.map(command => command.toJSON())
    }
  );
}

client.once('ready', async () => {
  console.log(
    `Alpha Bot V6 online como ${client.user.tag}`
  );

  for (const guild of client.guilds.cache.values()) {
    try {
      await register(guild);

      console.log(
        `Comandos registrados: ${guild.name}`
      );
    } catch (error) {
      console.error(
        `Erro registrando comandos em ${guild.name}:`,
        error.message
      );
    }
  }
});

client.on('guildCreate', async guild => {
  try {
    await register(guild);

    console.log(
      `Alpha Bot entrou em: ${guild.name}`
    );
  } catch (error) {
    console.error(
      'Erro no guildCreate:',
      error.message
    );
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.guild) return;

  try {
    if (interaction.isChatInputCommand()) {
      return await handleCommand(
        interaction,
        {
          gid,
          saveDB,
          saveNow,
          staff,
          staffOnly,
          product,
          currentTicket,
          ticketUserId,
          idify,
          money,
          stamp,
          nextId,
          audit,
          client,
          db,
          dbFile,
          backupDir
        }
      );
    }

    if (interaction.isButton()) {
      return await handleButton(
        interaction,
        {
          gid,
          saveDB,
          staff,
          product,
          currentTicket,
          ticketUserId,
          idify,
          money,
          stamp,
          nextId,
          audit,
          client
        }
      );
    }

    if (interaction.isStringSelectMenu()) {
      return await handleSelect(
        interaction,
        {
          gid,
          saveDB,
          staff,
          product,
          currentTicket,
          ticketUserId,
          idify,
          money,
          stamp,
          nextId,
          audit,
          client
        }
      );
    }

    if (interaction.isModalSubmit()) {
      return await handleModal(
        interaction,
        {
          gid,
          saveDB,
          staff,
          product,
          currentTicket,
          ticketUserId,
          idify,
          money,
          stamp,
          nextId,
          audit,
          client
        }
      );
    }
  } catch (error) {
    console.error('Interação:', error);

    const message = {
      content:
        '❌ Ocorreu um erro interno. Confira os logs do Railway.',
      ephemeral: true
    };

    if (interaction.replied || interaction.deferred) {
      await interaction
        .followUp(message)
        .catch(() => {});
    } else {
      await interaction
        .reply(message)
        .catch(() => {});
    }
  }
});

process.on('SIGTERM', () => {
  try {
    saveNow();
  } finally {
    process.exit(0);
  }
});

process.on('SIGINT', () => {
  try {
    saveNow();
  } finally {
    process.exit(0);
  }
});

client.login(TOKEN);
