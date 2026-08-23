require('dotenv').config();
const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token) throw new Error('DISCORD_TOKEN is missing from .env');
if (!clientId) throw new Error('CLIENT_ID is missing from .env');
if (!guildId) throw new Error('GUILD_ID is missing from .env. Instant guild commands require GUILD_ID.');

const commands = [
  new SlashCommandBuilder().setName('help').setDescription('Show Anime Cloud commands'),
  new SlashCommandBuilder().setName('ping').setDescription('Check bot latency'),
  new SlashCommandBuilder().setName('plans').setDescription('Show Anime Cloud VPS plans'),
  new SlashCommandBuilder().setName('status').setDescription('Show Anime Cloud service status'),
  new SlashCommandBuilder().setName('profile').setDescription('Show your customer profile'),
  new SlashCommandBuilder().setName('invoice').setDescription('Create PNG + PDF invoice')
    .addStringOption(o=>o.setName('customer').setDescription('Customer').setRequired(true))
    .addStringOption(o=>o.setName('items').setDescription('Name=Price, Name=Price').setRequired(true))
    .addStringOption(o=>o.setName('time').setDescription('Service time').setRequired(true))
    .addStringOption(o=>o.setName('status').setDescription('Payment status').addChoices({name:'PAID',value:'PAID'},{name:'PENDING',value:'PENDING'})),
  new SlashCommandBuilder().setName('order').setDescription('Create a hosting order')
    .addStringOption(o=>o.setName('plan').setDescription('Plan name').setRequired(true))
    .addStringOption(o=>o.setName('note').setDescription('Optional note')),
  new SlashCommandBuilder().setName('coupon').setDescription('Redeem a coupon')
    .addStringOption(o=>o.setName('code').setDescription('Coupon code').setRequired(true)),
  new SlashCommandBuilder().setName('ticket').setDescription('Open an Anime Cloud support ticket'),
  new SlashCommandBuilder().setName('warn').setDescription('Warn a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o=>o.setName('user').setDescription('Member').setRequired(true))
    .addStringOption(o=>o.setName('reason').setDescription('Reason').setRequired(true)),
  new SlashCommandBuilder().setName('purge').setDescription('Delete messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(o=>o.setName('amount').setDescription('1-100').setMinValue(1).setMaxValue(100).setRequired(true)),
  new SlashCommandBuilder().setName('admin').setDescription('Anime Cloud admin controls')
    .addSubcommand(s=>s.setName('stats').setDescription('Bot/server statistics'))
    .addSubcommand(s=>s.setName('broadcast').setDescription('Broadcast to this channel').addStringOption(o=>o.setName('message').setDescription('Message').setRequired(true)))
    .addSubcommand(s=>s.setName('coupon').setDescription('Create coupon').addStringOption(o=>o.setName('code').setDescription('Code').setRequired(true)).addIntegerOption(o=>o.setName('percent').setDescription('Discount percent').setMinValue(1).setMaxValue(100).setRequired(true)))
].map(command => command.toJSON());

async function refresh(){
  const rest = new REST({version:'10'}).setToken(token);
  const route = Routes.applicationGuildCommands(clientId, guildId);
  const result = await rest.put(route, {body: commands});
  const registered = await rest.get(route);
  console.log(`☁️ Anime Cloud: registered ${result.length} guild commands.`);
  console.log(`☁️ Anime Cloud: Discord reports ${registered.length} commands in guild ${guildId}.`);
  if (registered.length !== commands.length) {
    throw new Error(`Verification failed: expected ${commands.length}, Discord returned ${registered.length}. Check CLIENT_ID, GUILD_ID and bot installation.`);
  }
  console.log(`✅ Instant guild slash commands are active.`);
}

refresh().catch(error=>{ console.error('❌ Guild command refresh failed:', error.message); process.exit(1); });
