require('dotenv').config();
const { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const mongoose = require('mongoose');

const cfg = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  mongo: process.env.MONGODB_URI,
  adminRole: process.env.ADMIN_ROLE_ID,
  verifiedRole: process.env.VERIFIED_ROLE_ID,
  invite: process.env.ANIME_CLOUD_DISCORD_INVITE || 'https://discord.gg/YOUR_INVITE',
  messagePoints: Number(process.env.POINTS_PER_MESSAGE || 1),
  messageCooldown: Number(process.env.MESSAGE_COOLDOWN_SECONDS || 30) * 1000,
  vcPoints: Number(process.env.POINTS_PER_VC_INTERVAL || 5),
  vcMinutes: Number(process.env.VC_MINUTES_REQUIRED || 5),
  referralPoints: Number(process.env.POINTS_PER_REFERRAL || 50),
  walletMax: Number(process.env.WALLET_MAX || 15000),
  pointsPerRupee: Number(process.env.POINTS_PER_RUPEE || 100),
  dailyPoints: Number(process.env.DAILY_POINTS || 25)
};
if (!cfg.token || !cfg.clientId || !cfg.guildId || !cfg.mongo) throw new Error('Missing required environment variables.');

const User = mongoose.model('User', new mongoose.Schema({
  guildId: {type:String,index:true}, userId:{type:String,index:true}, username:String,
  verified:{type:Boolean,default:false}, points:{type:Number,default:0}, wallet:{type:Number,default:0},
  lifetimePoints:{type:Number,default:0}, referrals:{type:Number,default:0}, referredBy:String,
  lastMessageAt:{type:Date,default:null}, lastDailyAt:{type:Date,default:null},
  vcSince:{type:Date,default:null}, lastVcAwardAt:{type:Date,default:null}
},{timestamps:true}));

const commands = [
 new SlashCommandBuilder().setName('verify').setDescription('Verify yourself and unlock earning'),
 new SlashCommandBuilder().setName('balance').setDescription('View points and wallet balance'),
 new SlashCommandBuilder().setName('daily').setDescription('Claim your daily points'),
 new SlashCommandBuilder().setName('refer').setDescription('Get your referral code'),
 new SlashCommandBuilder().setName('leaderboard').setDescription('Show the points leaderboard'),
 new SlashCommandBuilder().setName('rewards').setDescription('See the points-to-wallet conversion'),
 new SlashCommandBuilder().setName('withdraw').setDescription('Request a wallet withdrawal').addIntegerOption(o=>o.setName('amount').setDescription('Amount in INR').setRequired(true).setMinValue(1)),
 new SlashCommandBuilder().setName('history').setDescription('View your account history'),
 new SlashCommandBuilder().setName('admin-add').setDescription('Admin: add points').addUserOption(o=>o.setName('user').setDescription('User').setRequired(true)).addIntegerOption(o=>o.setName('points').setDescription('Points').setRequired(true).setMinValue(1)),
 new SlashCommandBuilder().setName('admin-remove').setDescription('Admin: remove points').addUserOption(o=>o.setName('user').setDescription('User').setRequired(true)).addIntegerOption(o=>o.setName('points').setDescription('Points').setRequired(true).setMinValue(1))
].map(c=>c.toJSON());

const client = new Client({
  intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent,GatewayIntentBits.GuildVoiceStates],
  partials:[Partials.Channel]
});
const now = ()=>Date.now();
const getUser = async (guildId,userId,username)=>User.findOneAndUpdate(
  {guildId,userId},{$set:{username}},{upsert:true,new:true,setDefaultsOnInsert:true}
);
function embed(title, description){
  return new EmbedBuilder().setColor(0x8b5cf6).setTitle(title)
    .setDescription(description).setFooter({text:'Anime Cloud • Earn & Rewards'}).setTimestamp();
}
function isAdmin(member){
  return member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    (cfg.adminRole && member.roles.cache.has(cfg.adminRole));
}

client.once('ready', async ()=>{
  await mongoose.connect(cfg.mongo);
  const rest=new REST({version:'10'}).setToken(cfg.token);
  await rest.put(Routes.applicationGuildCommands(cfg.clientId,cfg.guildId),{body:commands});
  client.user.setPresence({activities:[{name:'Anime Cloud • /verify | /balance',type:0}],status:'online'});
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Wallet cap: ₹${cfg.walletMax}`);
});

client.on('messageCreate', async msg=>{
  if (!msg.guild || msg.author.bot) return;
  const u=await getUser(msg.guild.id,msg.author.id,msg.author.username);
  if (!u.verified) return;
  const t=now();
  if (!u.lastMessageAt || t-u.lastMessageAt.getTime()>=cfg.messageCooldown){
    u.points += cfg.messagePoints;
    u.lifetimePoints += cfg.messagePoints;
    u.lastMessageAt=new Date(t);
    await u.save();
  }
});

client.on('voiceStateUpdate', async (oldState,newState)=>{
  if (!newState.guild || newState.member?.user.bot) return;
  const u=await getUser(newState.guild.id,newState.id,newState.member.user.username);
  if (!u.verified) return;
  if (!oldState.channelId && newState.channelId){
    u.vcSince=new Date(); u.lastVcAwardAt=new Date(); await u.save();
  }
  if (oldState.channelId && !newState.channelId){
    u.vcSince=null; u.lastVcAwardAt=null; await u.save();
  }
});

setInterval(async ()=>{
  try {
    const users=await User.find({verified:true,vcSince:{$ne:null}});
    const t=now();
    for(const u of users){
      const diff=t-u.vcSince.getTime();
      if(diff < cfg.vcMinutes*60000) continue;
      const intervals=Math.floor((t-u.lastVcAwardAt.getTime())/(cfg.vcMinutes*60000));
      if(intervals>0){
        const add=intervals*cfg.vcPoints;
        u.points+=add; u.lifetimePoints+=add; u.lastVcAwardAt=new Date(t); await u.save();
      }
    }
  } catch(e){console.error('VC award error',e.message)}
},60000);

client.on('interactionCreate', async i=>{
  if(!i.isChatInputCommand()) return;
  const u=await getUser(i.guild.id,i.user.id,i.user.username);
  try{
    if(i.commandName==='verify'){
      u.verified=true; await u.save();
      if(cfg.verifiedRole){
        const role=i.guild.roles.cache.get(cfg.verifiedRole);
        if(role) await i.member.roles.add(role).catch(()=>{});
      }
      return i.reply({embeds:[embed('✅ Verification Complete',
        `You are now verified and can earn points.

💬 Messages: **+${cfg.messagePoints} point** per eligible message
🎙️ VC: **+${cfg.vcPoints} points** every ${cfg.vcMinutes} minutes

🔗 Anime Cloud: ${cfg.invite}`)]});
    }
    if(i.commandName==='balance')
      return i.reply({embeds:[embed('💰 Your Balance',
        `👤 <@${i.user.id}>
⭐ Points: **${u.points.toLocaleString()}**
💵 Wallet: **₹${u.wallet.toLocaleString()} / ₹${cfg.walletMax.toLocaleString()}**
🏆 Lifetime points: **${u.lifetimePoints.toLocaleString()}**

🔗 ${cfg.invite}`)]});
    if(i.commandName==='daily'){
      if(!u.verified) return i.reply({content:'❌ Run `/verify` first.',ephemeral:true});
      if(u.lastDailyAt && now()-u.lastDailyAt.getTime()<86400000)
        return i.reply({content:'⏳ Daily already claimed. Try again later.',ephemeral:true});
      u.points+=cfg.dailyPoints; u.lifetimePoints+=cfg.dailyPoints; u.lastDailyAt=new Date(); await u.save();
      return i.reply({embeds:[embed('🎁 Daily Reward',`You received **+${cfg.dailyPoints} points**.`)]});
    }
    if(i.commandName==='refer')
      return i.reply({embeds:[embed('🔗 Referral',
        `Your referral code is:
**${i.user.id}**

Invite users to Anime Cloud and use this code during verification.
Reward: **+${cfg.referralPoints} points** per valid referral.

${cfg.invite}`)]});
    if(i.commandName==='rewards')
      return i.reply({embeds:[embed('🎁 Rewards',
        `**${cfg.pointsPerRupee} points = ₹1 wallet credit**

Wallet limit: **₹${cfg.walletMax.toLocaleString()}**
Message earning: **+${cfg.messagePoints}**
VC earning: **+${cfg.vcPoints} / ${cfg.vcMinutes} min**`)]});
    if(i.commandName==='leaderboard'){
      const top=await User.find({guildId:i.guild.id,verified:true}).sort({lifetimePoints:-1}).limit(10);
      const lines=top.map((x,n)=>`**${n+1}.** <@${x.userId}> — ${x.lifetimePoints.toLocaleString()} pts`).join('\n')||'No verified users yet.';
      return i.reply({embeds:[embed('🏆 Leaderboard',lines)]});
    }
    if(i.commandName==='withdraw'){
      if(!u.verified) return i.reply({content:'❌ Run `/verify` first.',ephemeral:true});
      const amount=i.options.getInteger('amount');
      if(amount>u.wallet) return i.reply({content:`❌ Insufficient wallet balance. Available: ₹${u.wallet}`,ephemeral:true});
      if(amount>cfg.walletMax) return i.reply({content:`❌ Maximum wallet limit is ₹${cfg.walletMax}.`,ephemeral:true});
      u.wallet-=amount; await u.save();
      return i.reply({embeds:[embed('📤 Withdrawal Requested',
        `Amount: **₹${amount}**
Status: **Pending admin review**

⚠️ Your balance was reserved for this request. Contact Anime Cloud staff if needed.`)]});
    }
    if(i.commandName==='history')
      return i.reply({embeds:[embed('📜 Account',
        `Verified: **${u.verified?'Yes':'No'}**
Points: **${u.points}**
Wallet: **₹${u.wallet}**
Referrals: **${u.referrals}**
Lifetime points: **${u.lifetimePoints}`)]});
    if(['admin-add','admin-remove'].includes(i.commandName)){
      if(!isAdmin(i.member)) return i.reply({content:'❌ Admin only.',ephemeral:true});
      const target=i.options.getUser('user');
      const points=i.options.getInteger('points');
      const tu=await getUser(i.guild.id,target.id,target.username);
      if(i.commandName==='admin-add'){tu.points+=points;tu.lifetimePoints+=points;}
      else tu.points=Math.max(0,tu.points-points);
      await tu.save();
      return i.reply({content:`✅ ${i.commandName==='admin-add'?'Added':'Removed'} **${points} points** ${i.commandName==='admin-add'?'to':'from'} ${target}.`});
    }
  }catch(e){
    console.error(e);
    if(!i.replied) await i.reply({content:'❌ An internal error occurred.',ephemeral:true});
  }
});

process.on('unhandledRejection',console.error);
client.login(cfg.token);
