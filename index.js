const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.TOKEN;
if (!TOKEN) { console.error('TOKEN não configurado no Railway.'); process.exit(1); }

const dbFile = path.join(__dirname, 'data', 'store.json');
const backupDir = path.join(__dirname, 'data', 'backups');
fs.mkdirSync(path.dirname(dbFile), { recursive: true });
fs.mkdirSync(backupDir, { recursive: true });

let db = loadDB();
let saveTimer;
function loadDB() {
  try { return fs.existsSync(dbFile) ? JSON.parse(fs.readFileSync(dbFile, 'utf8')) : { version: 5, guilds: {} }; }
  catch (e) { console.error('Falha ao ler banco:', e); return { version: 5, guilds: {} }; }
}
function saveDB() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = `${dbFile}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, dbFile);
  }, 150);
}
function saveNow() { fs.writeFileSync(dbFile, JSON.stringify(db, null, 2)); }
function gid(guildId) {
  if (!db.guilds[guildId]) db.guilds[guildId] = {
    settings: { staffRoleId: '', logsChannelId: '', ticketCategoryId: '', panelMessages: [], pix: '', deliveryMode: 'ticket', maintenance: false, feedbackEnabled: true, lowStockThreshold: 2 },
    products: {}, tickets: {}, orders: {}, sales: [], reviews: [], audit: [], counters: { order: 0, sale: 0 }
  };
  return db.guilds[guildId];
}
function idify(s) { return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0, 50) || 'produto'; }
function money(n) { return `R$ ${Number(n).toFixed(2).replace('.', ',')}`; }
function stamp() { return new Date().toISOString(); }
function nextId(prefix, counter) { counter++; return { id: `${prefix}-${String(counter).padStart(5,'0')}`, counter }; }
function audit(g, actor, action, details='') { g.audit.unshift({ at: stamp(), actorId: actor, action, details }); g.audit = g.audit.slice(0, 500); saveDB(); }
function staff(interaction) {
  const g = gid(interaction.guildId);
  return !!(interaction.memberPermissions?.has('Administrator') || (g.settings.staffRoleId && interaction.member?.roles?.cache?.has(g.settings.staffRoleId)));
}
async function staffOnly(i) { if (!staff(i)) { await i.reply({content:'❌ Apenas a staff pode usar este comando.', ephemeral:true}); return false; } return true; }
function product(g, name) { return g.products[idify(name)] || Object.values(g.products).find(p => p.id === name || p.name.toLowerCase() === name.toLowerCase()); }
function currentTicket(g, channelId) { return Object.values(g.tickets).find(t => t.channelId === channelId && t.status !== 'closed'); }
function ticketUserId(channel, t) { return t?.userId || channel.permissionOverwrites.cache.find(x => x.type === 1 && x.allow.has('ViewChannel'))?.id; }

const { commands, handleCommand, handleButton, handleSelect, handleModal } = require('./src/handlers/interactions');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

async function register(guild) {
  const rest = new REST({version:'10'}).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: commands.map(c => c.toJSON()) });
}

client.once('ready', async () => {
  console.log(`Alpha Bot V5 online como ${client.user.tag}`);
  for (const guild of client.guilds.cache.values()) {
    try { await register(guild); console.log(`Comandos registrados: ${guild.name}`); } catch (e) { console.error(`Registro em ${guild.name}:`, e.message); }
  }
});
client.on('guildCreate', async guild => { try { await register(guild); } catch(e) { console.error('guildCreate:', e.message); } });
client.on('interactionCreate', async i => {
  if (!i.guild) return;
  try {
    if (i.isChatInputCommand()) return await handleCommand(i, {gid, saveDB, saveNow, staff, staffOnly, product, currentTicket, ticketUserId, idify, money, stamp, nextId, audit, client, db, dbFile, backupDir});
    if (i.isButton()) return await handleButton(i, {gid, saveDB, staff, product, currentTicket, ticketUserId, idify, money, stamp, nextId, audit, client});
    if (i.isStringSelectMenu()) return await handleSelect(i, {gid, saveDB, staff, product, currentTicket, ticketUserId, idify, money, stamp, nextId, audit, client});
    if (i.isModalSubmit()) return await handleModal(i, {gid, saveDB, staff, product, currentTicket, ticketUserId, idify, money, stamp, nextId, audit, client});
  } catch (e) {
    console.error('Interação:', e);
    const msg = {content:'❌ Ocorreu um erro interno. Confira os logs do Railway.', ephemeral:true};
    if (i.replied || i.deferred) await i.followUp(msg).catch(()=>{}); else await i.reply(msg).catch(()=>{});
  }
});

process.on('SIGTERM', () => { try { saveNow(); } finally { process.exit(0); } });
process.on('SIGINT', () => { try { saveNow(); } finally { process.exit(0); } });
client.login(TOKEN);
