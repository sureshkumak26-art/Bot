require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');

const cfg = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
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
if (!cfg.token || !cfg.clientId || !cfg.guildId) {
  throw new Error('Missing DISCORD_TOKEN, CLIENT_ID or GUILD_ID in .env');
}

const dataDir = path.join(__dirname, '..', 'data');
const dbFile = path.join(dataDir, 'database.json');
fs.mkdirSync(dataDir, { recursive: true });

function freshDb() { return { users: [], products: [], purchases: [], withdrawals: [] }; }
let db;
try {
  db = fs.existsSync(dbFile) ? JSON.parse(fs.readFileSync(dbFile, 'utf8')) : freshDb();
} catch (e) {
  console.error('Could not read database.json:', e.message);
  process.exit(1);
}
db.users ||= []; db.products ||= []; db.purchases ||= []; db.withdrawals ||= [];

function saveDb() {
  const tmp = dbFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, dbFile);
}
const makeId = () => crypto.randomUUID();
const now = () => Date.now();

function getUser(guildId, userId, username) {
  let u = db.users.find(x => x.guildId === guildId && x.userId === userId);
  if (!u) {
    u = { id: makeId(), guildId, userId, username: username || '', verified:false,
      points:0, wallet:0, lifetimePoints:0, referrals:0, referredBy:null,
      lastMessageAt:null, lastDailyAt:null, vcSince:null, lastVcAwardAt:null,
      createdAt:now(), updatedAt:now() };
    db.users.push(u);
    saveDb();
  } else if (username && u.username !== username) {
    u.username = username; u.updatedAt = now(); saveDb();
  }
  return u;
}
function touch(u) { u.updatedAt = now(); }
function addPoints(u, n) { u.points += n; u.lifetimePoints += n; touch(u); }
function embed(title, description) {
  return new EmbedBuilder().setColor(0x8b5cf6).setTitle(title).setDescription(description)
    .setFooter({text:'Anime Cloud • Earn & Rewards'}).setTimestamp();
}
function isAdmin(member) {
  return member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    (cfg.adminRole && member.roles.cache.has(cfg.adminRole));
}

const commands = [
  new SlashCommandBuilder().setName('verify').setDescription('Verify yourself and unlock earning'),
  new SlashCommandBuilder().setName('points').setDescription('View your earning points'),
  new SlashCommandBuilder().setName('balance').setDescription('View points and wallet balance'),
  new SlashCommandBuilder().setName('convert').setDescription('Convert points into wallet balance')
    .addIntegerOption(o=>o.setName('points').setDescription('Points to convert').setRequired(true).setMinValue(1)),
  new SlashCommandBuilder().setName('daily').setDescription('Claim daily points'),
  new SlashCommandBuilder().setName('refer').setDescription('Get your referral code'),
  new SlashCommandBuilder().setName('leaderboard').setDescription('Show points leaderboard'),
  new SlashCommandBuilder().setName('rewards').setDescription('See rewards and conversion'),
  new SlashCommandBuilder().setName('withdraw').setDescription('Request wallet withdrawal')
    .addIntegerOption(o=>o.setName('amount').setDescription('Amount in INR').setRequired(true).setMinValue(1)),
  new SlashCommandBuilder().setName('history').setDescription('View account history'),
  new SlashCommandBuilder().setName('products').setDescription('View products and points rewards'),
  new SlashCommandBuilder().setName('buy').setDescription('Create a product purchase request')
    .addStringOption(o=>o.setName('product').setDescription('Product name').setRequired(true)),
  new SlashCommandBuilder().setName('admin-product-add').setDescription('Admin: add a product')
    .addStringOption(o=>o.setName('name').setDescription('Product name').setRequired(true))
    .addIntegerOption(o=>o.setName('price').setDescription('Price INR').setRequired(true).setMinValue(0))
    .addIntegerOption(o=>o.setName('points').setDescription('Points after approval').setRequired(true).setMinValue(1))
    .addStringOption(o=>o.setName('description').setDescription('Description')),
  new SlashCommandBuilder().setName('admin-products').setDescription('Admin: list products'),
  new SlashCommandBuilder().setName('admin-purchases').setDescription('Admin: list pending purchases'),
  new SlashCommandBuilder().setName('admin-buy-approve').setDescription('Admin: approve purchase')
    .addStringOption(o=>o.setName('id').setDescription('Purchase ID').setRequired(true)),
  new SlashCommandBuilder().setName('admin-buy-reject').setDescription('Admin: reject purchase')
    .addStringOption(o=>o.setName('id').setDescription('Purchase ID').setRequired(true)),
  new SlashCommandBuilder().setName('admin-withdrawals').setDescription('Admin: list withdrawals'),
  new SlashCommandBuilder().setName('admin-set-withdraw-ticket-category').setDescription('Admin: set withdrawal ticket category')
    .addChannelOption(o=>o.setName('category').setDescription('Category for approved withdrawal tickets').setRequired(true)),
  new SlashCommandBuilder().setName('admin-set-withdraw-alerts').setDescription('Admin: set withdrawal alert channel')
    .addChannelOption(o=>o.setName('channel').setDescription('Alert channel').setRequired(true)),
  new SlashCommandBuilder().setName('admin-withdraw-approve').setDescription('Admin: approve withdrawal')
    .addStringOption(o=>o.setName('id').setDescription('Withdrawal ID').setRequired(true)),
  new SlashCommandBuilder().setName('admin-withdraw-reject').setDescription('Admin: reject withdrawal')
    .addStringOption(o=>o.setName('id').setDescription('Withdrawal ID').setRequired(true)),
  new SlashCommandBuilder().setName('admin-add').setDescription('Admin: add points')
    .addUserOption(o=>o.setName('user').setDescription('User').setRequired(true))
    .addIntegerOption(o=>o.setName('points').setDescription('Points').setRequired(true).setMinValue(1)),
  new SlashCommandBuilder().setName('admin-remove').setDescription('Admin: remove points')
    .addUserOption(o=>o.setName('user').setDescription('User').setRequired(true))
    .addIntegerOption(o=>o.setName('points').setDescription('Points').setRequired(true).setMinValue(1))
].map(c=>c.toJSON());

const client = new Client({
  intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent,GatewayIntentBits.GuildVoiceStates],
  partials:[Partials.Channel]
});

client.once('ready', async ()=>{
  try {
    const rest = new REST({version:'10'}).setToken(cfg.token);
    await rest.put(Routes.applicationGuildCommands(cfg.clientId,cfg.guildId),{body:commands});
    client.user.setPresence({activities:[{name:'Anime Cloud • /verify | /balance',type:0}],status:'online'});
    console.log('Local JSON database:', dbFile);
    console.log('Logged in as ' + client.user.tag);
    console.log('Wallet cap: ₹' + cfg.walletMax);
  } catch(e) { console.error('Setup error:',e); }
});

client.on('messageCreate', async msg=>{
  try {
    if(!msg.guild || msg.author.bot) return;
    const u=getUser(msg.guild.id,msg.author.id,msg.author.username);
    if(!u.verified) return;
    if(!u.lastMessageAt || now()-u.lastMessageAt>=cfg.messageCooldown) {
      addPoints(u,cfg.messagePoints); u.lastMessageAt=now(); saveDb();
    }
  } catch(e) { console.error('Message points error:',e.message); }
});

client.on('voiceStateUpdate', async (oldState,newState)=>{
  try {
    if(!newState.guild || newState.member?.user.bot) return;
    const u=getUser(newState.guild.id,newState.id,newState.member.user.username);
    if(!u.verified) return;
    if(!oldState.channelId && newState.channelId) {
      u.vcSince=now(); u.lastVcAwardAt=now(); touch(u); saveDb();
    }
    if(oldState.channelId && !newState.channelId) {
      u.vcSince=null; u.lastVcAwardAt=null; touch(u); saveDb();
    }
  } catch(e) { console.error('Voice error:',e.message); }
});

setInterval(()=>{
  try {
    let changed=false, t=now();
    for(const u of db.users.filter(x=>x.verified&&x.vcSince&&x.lastVcAwardAt)) {
      if(t-u.vcSince < cfg.vcMinutes*60000) continue;
      const intervals=Math.floor((t-u.lastVcAwardAt)/(cfg.vcMinutes*60000));
      if(intervals>0) { addPoints(u,intervals*cfg.vcPoints); u.lastVcAwardAt=t; changed=true; }
    }
    if(changed) saveDb();
  } catch(e) { console.error('VC award error:',e.message); }
},60000);

client.on('interactionCreate', async i=>{
  if(!i.isChatInputCommand()) return;
  try {
    const u=getUser(i.guild.id,i.user.id,i.user.username);

    if(i.commandName==='verify') {
      u.verified=true; touch(u); saveDb();
      if(cfg.verifiedRole) {
        const role=i.guild.roles.cache.get(cfg.verifiedRole);
        if(role) await i.member.roles.add(role).catch(()=>{});
      }
      return i.reply({embeds:[embed('✅ Verification Complete',
        'You are verified and can earn points.\\n\\n💬 Messages: +' + cfg.messagePoints +
        ' point per eligible message\\n🎙️ VC: +' + cfg.vcPoints + ' points every ' +
        cfg.vcMinutes + ' minutes\\n\\n🔗 Anime Cloud: ' + cfg.invite)]});
    }

    if(i.commandName==='points')
      return i.reply({embeds:[embed('⭐ Your Points',
        'Current Points: **'+u.points.toLocaleString()+'**\\nLifetime Points: **'+u.lifetimePoints.toLocaleString()+
        '**\\nConversion Rate: **'+cfg.pointsPerRupee+' points = ₹1**\\nWallet: **₹'+u.wallet.toLocaleString()+' / ₹'+cfg.walletMax.toLocaleString()+'**')]});

    if(i.commandName==='balance')
      return i.reply({embeds:[embed('💰 Your Balance',
        '👤 <@'+i.user.id+'>\\n⭐ Points: **'+u.points.toLocaleString()+
        '**\\n💵 Wallet: **₹'+u.wallet.toLocaleString()+' / ₹'+cfg.walletMax.toLocaleString()+
        '**\\n🏆 Lifetime points: **'+u.lifetimePoints.toLocaleString()+'**\\n\\n🔗 '+cfg.invite)]});

    if(i.commandName==='convert') {
      if(!u.verified) return i.reply({content:'❌ Run /verify first.',ephemeral:true});
      const points=i.options.getInteger('points');
      if(points>u.points) return i.reply({content:'❌ Insufficient points. You have '+u.points.toLocaleString()+' points.',ephemeral:true});
      const rupees=Math.floor(points/cfg.pointsPerRupee);
      if(rupees<1) return i.reply({content:'❌ You need at least '+cfg.pointsPerRupee+' points to convert ₹1.',ephemeral:true});
      const usablePoints=rupees*cfg.pointsPerRupee;
      if(u.wallet>=cfg.walletMax) return i.reply({content:'❌ Your wallet is already at the ₹'+cfg.walletMax.toLocaleString()+' limit.',ephemeral:true});
      const room=cfg.walletMax-u.wallet;
      const credit=Math.min(rupees,room);
      const spent=credit*cfg.pointsPerRupee;
      u.points-=spent;
      u.wallet+=credit;
      touch(u); saveDb();
      return i.reply({embeds:[embed('💱 Points Converted',
        'Converted **'+spent.toLocaleString()+' points** into **₹'+credit.toLocaleString()+' wallet balance**.\\n\\n⭐ Remaining points: **'+u.points.toLocaleString()+'**\\n💵 Wallet: **₹'+u.wallet.toLocaleString()+' / ₹'+cfg.walletMax.toLocaleString()+'**')]});
    }

    if(i.commandName==='daily') {
      if(!u.verified) return i.reply({content:'❌ Run /verify first.',ephemeral:true});
      if(u.lastDailyAt && now()-u.lastDailyAt<86400000)
        return i.reply({content:'⏳ Daily already claimed. Try again later.',ephemeral:true});
      addPoints(u,cfg.dailyPoints); u.lastDailyAt=now(); saveDb();
      return i.reply({embeds:[embed('🎁 Daily Reward','You received **+'+cfg.dailyPoints+' points**.')]});
    }

    if(i.commandName==='refer')
      return i.reply({embeds:[embed('🔗 Referral',
        'Your referral code is:\\n**'+i.user.id+'**\\n\\nReward: **+'+cfg.referralPoints+
        ' points** per valid referral.\\n\\n'+cfg.invite)]});

    if(i.commandName==='rewards')
      return i.reply({embeds:[embed('🎁 Rewards',
        '**'+cfg.pointsPerRupee+' points = ₹1 wallet credit**\\n\\nWallet limit: **₹'+
        cfg.walletMax.toLocaleString()+'**\\nMessage: **+'+cfg.messagePoints+
        '**\\nVC: **+'+cfg.vcPoints+' / '+cfg.vcMinutes+' min**\\n\\nPoint-to-wallet conversion must be handled by your configured admin/payment workflow.')]});

    if(i.commandName==='leaderboard') {
      const top=db.users.filter(x=>x.guildId===i.guild.id&&x.verified)
        .sort((a,b)=>b.lifetimePoints-a.lifetimePoints).slice(0,10);
      const lines=top.map((x,n)=>'**'+(n+1)+'.** <@'+x.userId+'> — '+x.lifetimePoints.toLocaleString()+' pts').join('\\n')||'No verified users yet.';
      return i.reply({embeds:[embed('🏆 Leaderboard',lines)]});
    }

    if(i.commandName==='withdraw') {
      if(!u.verified) return i.reply({content:'❌ Run /verify first.',ephemeral:true});
      const amount=i.options.getInteger('amount');
      if(amount>u.wallet) return i.reply({content:'❌ Insufficient wallet balance. Available: ₹'+u.wallet,ephemeral:true});
      if(amount>cfg.walletMax) return i.reply({content:'❌ Maximum withdrawal is ₹'+cfg.walletMax+'.',ephemeral:true});
      if(db.withdrawals.some(x=>x.guildId===i.guild.id&&x.userId===i.user.id&&x.status==='pending'))
        return i.reply({content:'❌ You already have a pending withdrawal.',ephemeral:true});
      u.wallet-=amount;
      const w={id:makeId(),guildId:i.guild.id,userId:i.user.id,amount,status:'pending',createdAt:now(),approvedBy:null};
      db.withdrawals.push(w); touch(u); saveDb();
      const alertChannelId = process.env.WITHDRAW_ALERT_CHANNEL_ID;
      if(alertChannelId) {
        const alertChannel = i.guild.channels.cache.get(alertChannelId);
        if(alertChannel && alertChannel.isTextBased()) {
          await alertChannel.send({embeds:[embed('🚨 Withdrawal Request Received',
            '👤 User: <@'+i.user.id+'>\n💰 Amount: **₹'+amount+'**\n🆔 Request ID: **'+w.id+'**\n📊 Status: **⏳ Pending Review**\n\n⚠️ Admin action required.')]})
            .catch(e=>console.error('Withdrawal alert error:',e.message));
        }
      }
      return i.reply({embeds:[embed('📤 Withdrawal Requested',
        'Withdrawal ID: **'+w.id+'**\\nAmount: **₹'+amount+'**\\nStatus: **Pending admin review**')]});
    }

    if(i.commandName==='history') {
      const p=db.purchases.filter(x=>x.guildId===i.guild.id&&x.userId===i.user.id).slice(-5).reverse();
      const w=db.withdrawals.filter(x=>x.guildId===i.guild.id&&x.userId===i.user.id).slice(-5).reverse();
      return i.reply({embeds:[embed('📜 Account History',
        'Verified: **'+(u.verified?'Yes':'No')+'**\\nPoints: **'+u.points.toLocaleString()+
        '**\\nWallet: **₹'+u.wallet.toLocaleString()+'**\\nReferrals: **'+u.referrals+
        '**\\nLifetime points: **'+u.lifetimePoints.toLocaleString()+'**\\n\\n**Purchases**\\n'+
        (p.map(x=>x.productName+' — '+x.status).join('\\n')||'None')+'\\n\\n**Withdrawals**\\n'+
        (w.map(x=>'₹'+x.amount+' — '+x.status).join('\\n')||'None'))]});
    }

    if(i.commandName==='products') {
      const products=db.products.filter(x=>x.guildId===i.guild.id&&x.active).sort((a,b)=>a.price-b.price).slice(0,25);
      const lines=products.map((p,n)=>'**'+(n+1)+'. '+p.name+'** — ₹'+p.price.toLocaleString()+
        ' → **+'+p.points.toLocaleString()+' points**\\n'+(p.description||'Anime Cloud product')).join('\\n\\n')||'No products are available yet.';
      return i.reply({embeds:[embed('🛒 Anime Cloud Products',lines)]});
    }

    if(i.commandName==='buy') {
      if(!u.verified) return i.reply({content:'❌ Run /verify first.',ephemeral:true});
      const name=i.options.getString('product').trim().toLowerCase();
      const product=db.products.find(x=>x.guildId===i.guild.id&&x.active&&x.name.toLowerCase()===name);
      if(!product) return i.reply({content:'❌ Product not found. Use /products.',ephemeral:true});
      const purchase={id:makeId(),guildId:i.guild.id,userId:i.user.id,productId:product.id,
        productName:product.name,price:product.price,points:product.points,status:'pending',createdAt:now(),approvedBy:null};
      db.purchases.push(purchase); saveDb();
      return i.reply({embeds:[embed('🛒 Purchase Created',
        'Purchase ID: **'+purchase.id+'**\\nProduct: **'+product.name+'**\\nPrice: **₹'+
        product.price+'**\\nReward: **+'+product.points+' points**\\n\\nStatus: **Pending admin approval**.')]});
    }

    if(i.commandName==='admin-product-add') {
      if(!isAdmin(i.member)) return i.reply({content:'❌ Admin only.',ephemeral:true});
      const name=i.options.getString('name').trim(), price=i.options.getInteger('price'),
        points=i.options.getInteger('points'), description=i.options.getString('description')||'';
      if(db.products.some(x=>x.guildId===i.guild.id&&x.name.toLowerCase()===name.toLowerCase()))
        return i.reply({content:'❌ Product already exists.',ephemeral:true});
      db.products.push({id:makeId(),guildId:i.guild.id,name,price,points,description,active:true,createdAt:now()});
      saveDb();
      return i.reply({content:'✅ Product created: **'+name+'** — ₹'+price+' → +'+points+' points.'});
    }

    if(i.commandName==='admin-products') {
      if(!isAdmin(i.member)) return i.reply({content:'❌ Admin only.',ephemeral:true});
      const lines=db.products.filter(x=>x.guildId===i.guild.id).map(p=>'**'+p.id+'** — '+p.name+' — ₹'+p.price+' → +'+p.points+' — '+(p.active?'ACTIVE':'OFF')).join('\\n')||'No products.';
      return i.reply({embeds:[embed('🛠️ Products',lines)],ephemeral:true});
    }

    if(i.commandName==='admin-purchases') {
      if(!isAdmin(i.member)) return i.reply({content:'❌ Admin only.',ephemeral:true});
      const rows=db.purchases.filter(x=>x.guildId===i.guild.id&&x.status==='pending').slice(0,20);
      const lines=rows.map(p=>'**'+p.id+'**\\n<@'+p.userId+'> — '+p.productName+' — ₹'+p.price+' → +'+p.points).join('\\n\\n')||'No pending purchases.';
      return i.reply({embeds:[embed('📋 Pending Purchases',lines)],ephemeral:true});
    }

    if(i.commandName==='admin-buy-approve'||i.commandName==='admin-buy-reject') {
      if(!isAdmin(i.member)) return i.reply({content:'❌ Admin only.',ephemeral:true});
      const purchase=db.purchases.find(x=>x.guildId===i.guild.id&&x.id===i.options.getString('id').trim());
      if(!purchase) return i.reply({content:'❌ Purchase not found.',ephemeral:true});
      if(purchase.status!=='pending') return i.reply({content:'❌ Purchase is already '+purchase.status+'.',ephemeral:true});
      if(i.commandName==='admin-buy-approve') {
        const buyer=getUser(i.guild.id,purchase.userId,''); addPoints(buyer,purchase.points);
        purchase.status='approved'; purchase.approvedBy=i.user.id; purchase.approvedAt=now(); saveDb();
        return i.reply({embeds:[embed('✅ Purchase Approved','<@'+purchase.userId+'> received **+'+purchase.points+' points** for **'+purchase.productName+'**.')]});
      }
      purchase.status='rejected'; purchase.rejectedBy=i.user.id; purchase.rejectedAt=now(); saveDb();
      return i.reply({embeds:[embed('❌ Purchase Rejected','Purchase **'+purchase.id+'** was rejected.')]});
    }

    if(i.commandName==='admin-set-withdraw-alerts') {
      if(!isAdmin(i.member)) return i.reply({content:'❌ Admin only.',ephemeral:true});
      const channel=i.options.getChannel('channel');
      if(!channel.isTextBased()) return i.reply({content:'❌ Select a text channel.',ephemeral:true});
      return i.reply({content:'Use this in .env:\nWITHDRAW_ALERT_CHANNEL_ID='+channel.id+'\nThen restart the bot.',ephemeral:true});
    }

    if(i.commandName==='admin-withdrawals') {
      if(!isAdmin(i.member)) return i.reply({content:'❌ Admin only.',ephemeral:true});
      const rows=db.withdrawals.filter(x=>x.guildId===i.guild.id&&x.status==='pending').slice(0,20);
      const lines=rows.map(w=>'**'+w.id+'** — <@'+w.userId+'> — ₹'+w.amount).join('\\n')||'No pending withdrawals.';
      return i.reply({embeds:[embed('📤 Pending Withdrawals',lines)],ephemeral:true});
    }

    if(i.commandName==='admin-set-withdraw-ticket-category') {
      if(!isAdmin(i.member)) return i.reply({content:'❌ Admin only.',ephemeral:true});
      const category=i.options.getChannel('category');
      if(category.type!==0 && category.type!==4) return i.reply({content:'❌ Select a category channel.',ephemeral:true});
      return i.reply({content:'Use this in .env:\nWITHDRAW_TICKET_CATEGORY_ID='+category.id+'\nThen restart the bot.',ephemeral:true});
    }

    if(i.commandName==='admin-withdraw-approve'||i.commandName==='admin-withdraw-reject') {
      if(!isAdmin(i.member)) return i.reply({content:'❌ Admin only.',ephemeral:true});
      const w=db.withdrawals.find(x=>x.guildId===i.guild.id&&x.id===i.options.getString('id').trim());
      if(!w) return i.reply({content:'❌ Withdrawal not found.',ephemeral:true});
      if(w.status!=='pending') return i.reply({content:'❌ Withdrawal is already '+w.status+'.',ephemeral:true});
      if(i.commandName==='admin-withdraw-approve') {
        w.status='approved'; w.approvedBy=i.user.id; w.approvedAt=now();

        let ticketText='Ticket could not be created automatically.';
        const categoryId=process.env.WITHDRAW_TICKET_CATEGORY_ID;
        if(categoryId) {
          try {
            const channel=await i.guild.channels.create({
              name:'withdraw-'+w.id.slice(0,8),
              type:0,
              parent:categoryId,
              permissionOverwrites:[
                {id:i.guild.roles.everyone.id,deny:['ViewChannel']},
                {id:w.userId,allow:['ViewChannel','SendMessages','ReadMessageHistory']},
                {id:i.guild.members.me.id,allow:['ViewChannel','SendMessages','ReadMessageHistory','ManageChannels']},
                {id:i.member.id,allow:['ViewChannel','SendMessages','ReadMessageHistory']}
              ]
            });
            ticketText='<#'+channel.id+'>';
            await channel.send({embeds:[embed('💸 Withdrawal Ticket','👤 User: <@'+w.userId+'>\\n💰 Amount: **₹'+w.amount+'**\\n🆔 Request ID: **'+w.id+'**\\n📊 Status: **Approved**\\n\\nPlease process the payout and close this ticket after completion.')]});
            w.ticketChannelId=channel.id;
          } catch(e) { console.error('Withdrawal ticket error:',e.message); }
        }
        saveDb();
        return i.reply({embeds:[embed('✅ Withdrawal Approved','Withdrawal **'+w.id+'** for **₹'+w.amount+'** approved.\\n🎫 Ticket: '+ticketText)]});
      }
      const owner=getUser(i.guild.id,w.userId,'');
      owner.wallet=Math.min(cfg.walletMax,owner.wallet+w.amount);
      w.status='rejected'; w.rejectedBy=i.user.id; w.rejectedAt=now(); saveDb();
      return i.reply({embeds:[embed('❌ Withdrawal Rejected','₹'+w.amount+' restored to <@'+w.userId+'>.')]});
    }

    if(i.commandName==='admin-add'||i.commandName==='admin-remove') {
      if(!isAdmin(i.member)) return i.reply({content:'❌ Admin only.',ephemeral:true});
      const target=i.options.getUser('user'), points=i.options.getInteger('points'), tu=getUser(i.guild.id,target.id,target.username);
      if(i.commandName==='admin-add') addPoints(tu,points);
      else { tu.points=Math.max(0,tu.points-points); touch(tu); }
      saveDb();
      return i.reply({content:'✅ '+(i.commandName==='admin-add'?'Added':'Removed')+' **'+points+' points** '+(i.commandName==='admin-add'?'to ':'from ')+target+'.'});
    }
  } catch(e) {
    console.error('Command error:',e);
    if(!i.replied&&!i.deferred) await i.reply({content:'❌ An internal error occurred.',ephemeral:true}).catch(()=>{});
  }
});

process.on('unhandledRejection',e=>console.error('Unhandled rejection:',e));
process.on('uncaughtException',e=>console.error('Uncaught exception:',e));
client.login(cfg.token);
