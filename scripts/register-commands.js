require('dotenv').config();
const { REST, Routes } = require('discord.js');
const commands = require('../src/commands');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
if (!token) throw new Error('DISCORD_TOKEN is missing from .env');
if (!clientId) throw new Error('CLIENT_ID is missing from .env');
if (!guildId) throw new Error('GUILD_ID is missing from .env. Instant guild commands require GUILD_ID.');

(async()=>{
  const rest = new REST({version:'10'}).setToken(token);
  const route = Routes.applicationGuildCommands(clientId, guildId);
  const registered = await rest.put(route, {body: commands});
  console.log(`☁️ Anime Cloud: registered ${registered.length} guild commands.`);
  const check = await rest.get(route);
  console.log(`☁️ Anime Cloud: Discord reports ${check.length} commands in guild ${guildId}.`);
  if (check.length !== commands.length) throw new Error(`Verification failed: expected ${commands.length}, Discord returned ${check.length}.`);
  console.log('✅ Instant guild slash commands are active.');
})().catch(error=>{ console.error('❌ Guild command refresh failed:', error.message); process.exit(1); });
