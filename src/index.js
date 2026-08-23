require('dotenv').config();
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const sharp = require('sharp');
const {
  Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder,
  PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, AttachmentBuilder
} = require('discord.js');

const DATA_DIR = path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = path.join(DATA_DIR, 'database.json');
const db = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) : { warnings: {}, tickets: {}, orders: {}, coupons: {}, settings: {} };
function save(){ fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }
function money(n){ return `₹${Number(n).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`; }
function id(prefix){ return `${prefix}-${Date.now().toString().slice(-8)}`; }
function admin(i){ return i.memberPermissions?.has(PermissionFlagsBits.ManageGuild); }
function parseItems(raw){
  const items = raw.split(',').map(x=>x.trim()).filter(Boolean).map(x=>{
    const p=x.lastIndexOf('='); if(p<1) throw new Error('Use Name=Price, Name=Price');
    const name=x.slice(0,p).trim(), price=Number(x.slice(p+1).replace(/[^0-9.]/g,''));
    if(!name || !Number.isFinite(price) || price<0) throw new Error('Invalid item or price');
    return {name,price};
  });
  if(!items.length || items.length>50) throw new Error('Invoice must contain 1–50 items');
  return items;
}
function makeInvoicePDF({customer,items,time,status,number}){
  return new Promise((resolve,reject)=>{
    const d=new PDFDocument({size:'A4',margin:45}), chunks=[];
    d.on('data',c=>chunks.push(c)); d.on('end',()=>resolve(Buffer.concat(chunks))); d.on('error',reject);
    const total=items.reduce((a,b)=>a+b.price,0);
    d.rect(0,0,595,842).fill('#0b0d19'); d.fillColor('#fff').fontSize(25).text('ANIME CLOUD',55,55);
    d.fillColor('#9ea8c7').fontSize(9).text('PREMIUM CLOUD • VPS • DOMAINS • HOSTING',55,88);
    d.fillColor('#fff').fontSize(24).text('INVOICE',400,55,{align:'right'}); d.fillColor('#9ea8c7').fontSize(9).text(number,400,88,{align:'right'});
    d.moveTo(55,125).lineTo(540,125).stroke('#30364e'); d.fillColor('#8f99b7').fontSize(9).text('BILLED TO',55,155); d.fillColor('#fff').fontSize(14).text(customer,55,173);
    d.fillColor('#8f99b7').fontSize(9).text('SERVICE TIME',330,155); d.fillColor('#fff').fontSize(14).text(time,330,173);
    let y=225; d.fillColor('#8f99b7').fontSize(9).text('ITEM',55,y); d.text('AMOUNT',430,y,{width:110,align:'right'}); y+=28;
    items.forEach(x=>{d.fillColor('#f5f7ff').fontSize(12).text(x.name,55,y,{width:350}); d.text(money(x.price),430,y,{width:110,align:'right'}); y+=32;});
    d.moveTo(55,y+5).lineTo(540,y+5).stroke('#30364e'); d.fillColor('#aeb8d4').fontSize(12).text('TOTAL',350,y+28); d.fillColor('#fff').fontSize(22).text(money(total),430,y+25,{width:110,align:'right'});
    d.fillColor('#62d9ff').roundedRect(55,y+80,100,28,14).fill(); d.fillColor('#07111c').fontSize(10).text(status,55,y+89,{width:100,align:'center'});
    d.fillColor('#9ea8c7').fontSize(9).text('Thank you for choosing Anime Cloud.',55,760); d.end();
  });
}
async function makeInvoicePNG({customer,items,time,status,number}){
  const total=items.reduce((a,b)=>a+b.price,0), H=Math.max(850,430+items.length*70);
  const rows=items.map((x,i)=>`<text x="100" y="${450+i*65}" class="item">${String(x.name).replace(/[&<>]/g,'')}</text><text x="1300" y="${450+i*65}" class="price" text-anchor="end">${money(x.price)}</text>`).join('');
  const svg=`<svg width="1400" height="${H}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g"><stop stop-color="#090b18"/><stop offset="1" stop-color="#17102b"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><rect x="45" y="45" width="1310" height="${H-90}" rx="30" fill="#ffffff" opacity=".045" stroke="#ffffff" stroke-opacity=".12"/><text x="100" y="135" class="brand">ANIME CLOUD</text><text x="100" y="175" class="tag">PREMIUM CLOUD • VPS • DOMAINS • HOSTING</text><text x="1300" y="135" class="inv" text-anchor="end">INVOICE</text><text x="1300" y="175" class="meta" text-anchor="end">${number}</text><line x1="100" y1="225" x2="1300" y2="225" stroke="#fff" stroke-opacity=".15"/><text x="100" y="285" class="label">BILLED TO</text><text x="100" y="325" class="customer">${String(customer).replace(/[&<>]/g,'')}</text><text x="700" y="285" class="label">SERVICE TIME</text><text x="700" y="325" class="customer">${String(time).replace(/[&<>]/g,'')}</text><text x="100" y="395" class="label">ITEM</text><text x="1300" y="395" class="label" text-anchor="end">AMOUNT</text>${rows}<line x1="100" y1="${470+items.length*65}" x2="1300" y2="${470+items.length*65}" stroke="#fff" stroke-opacity=".15"/><text x="1000" y="${530+items.length*65}" class="totalLabel">TOTAL</text><text x="1300" y="${530+items.length*65}" class="total" text-anchor="end">${money(total)}</text><text x="100" y="${650+items.length*65}" class="footer">${status} • Thank you for choosing Anime Cloud.</text><style>.brand{font:700 48px Arial;fill:#fff;letter-spacing:4px}.tag,.meta,.label{font:500 17px Arial;fill:#9ea8c7}.inv{font:700 42px Arial;fill:#fff}.label{font-size:15px;letter-spacing:2px}.customer,.item{font:600 26px Arial;fill:#fff}.price{font:600 25px Arial;fill:#dce7ff}.totalLabel{font:600 25px Arial;fill:#aeb8d4}.total{font:700 42px Arial;fill:#fff}.footer{font:600 21px Arial;fill:#cbd4ed}</style></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

const commands=[
 new SlashCommandBuilder().setName('help').setDescription('Show Anime Cloud commands'),
 new SlashCommandBuilder().setName('ping').setDescription('Check bot latency'),
 new SlashCommandBuilder().setName('plans').setDescription('Show Anime Cloud VPS plans'),
 new SlashCommandBuilder().setName('status').setDescription('Show Anime Cloud service status'),
 new SlashCommandBuilder().setName('profile').setDescription('Show your customer profile'),
 new SlashCommandBuilder().setName('invoice').setDescription('Create PNG + PDF invoice').addStringOption(o=>o.setName('customer').setDescription('Customer').setRequired(true)).addStringOption(o=>o.setName('items').setDescription('Name=Price, Name=Price').setRequired(true)).addStringOption(o=>o.setName('time').setDescription('Service time').setRequired(true)).addStringOption(o=>o.setName('status').setDescription('Payment status').addChoices({name:'PAID',value:'PAID'},{name:'PENDING',value:'PENDING'})),
 new SlashCommandBuilder().setName('order').setDescription('Create a hosting order').addStringOption(o=>o.setName('plan').setDescription('Plan name').setRequired(true)).addStringOption(o=>o.setName('note').setDescription('Optional note')),
 new SlashCommandBuilder().setName('coupon').setDescription('Redeem a coupon').addStringOption(o=>o.setName('code').setDescription('Coupon code').setRequired(true)),
 new SlashCommandBuilder().setName('ticket').setDescription('Open an Anime Cloud support ticket'),
 new SlashCommandBuilder().setName('warn').setDescription('Warn a member').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers).addUserOption(o=>o.setName('user').setDescription('Member').setRequired(true)).addStringOption(o=>o.setName('reason').setDescription('Reason').setRequired(true)),
 new SlashCommandBuilder().setName('purge').setDescription('Delete messages').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages).addIntegerOption(o=>o.setName('amount').setDescription('1-100').setMinValue(1).setMaxValue(100).setRequired(true)),
 new SlashCommandBuilder().setName('admin').setDescription('Anime Cloud admin controls').addSubcommand(s=>s.setName('stats').setDescription('Bot/server statistics')).addSubcommand(s=>s.setName('broadcast').setDescription('Broadcast to this channel').addStringOption(o=>o.setName('message').setDescription('Message').setRequired(true))).addSubcommand(s=>s.setName('coupon').setDescription('Create coupon').addStringOption(o=>o.setName('code').setDescription('Code').setRequired(true)).addIntegerOption(o=>o.setName('percent').setDescription('Discount percent').setMinValue(1).setMaxValue(100).setRequired(true)))
].map(x=>x.toJSON());

const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers]});
client.once('ready',async()=>{const rest=new REST({version:'10'}).setToken(process.env.DISCORD_TOKEN);await rest.put(Routes.applicationCommands(client.user.id),{body:commands});console.log(`Anime Cloud Bot online as ${client.user.tag}`);});
client.on('interactionCreate',async i=>{
 if(!i.isChatInputCommand()) return;
 try{
  if(i.commandName==='ping') return i.reply(`☁️ **Anime Cloud** • ${client.ws.ping}ms`);
  if(i.commandName==='help') return i.reply({embeds:[new EmbedBuilder().setColor(0x8b5cf6).setTitle('☁️ Anime Cloud Bot').setDescription('Professional hosting management & community bot.').addFields({name:'Customer',value:'`/plans` `/status` `/profile` `/order` `/coupon` `/ticket` `/invoice`'},{name:'Moderation',value:'`/warn` `/purge`'},{name:'Admin',value:'`/admin stats` `/admin broadcast` `/admin coupon`'})]});
  if(i.commandName==='plans') return i.reply({embeds:[new EmbedBuilder().setColor(0x62d9ff).setTitle('☁️ Anime Cloud VPS Plans').setDescription('**Tiny** — 1GB RAM • 10GB NVMe • 1 vCPU — ₹19/mo\n**Starter** — 2GB • 20GB • 2 vCPU — ₹39/mo\n**Basic** — 3GB • 30GB • 2 vCPU — ₹59/mo\n**Plus** — 4GB • 40GB • 2 vCPU — ₹79/mo\n**Standard** — 6GB • 60GB • 4 vCPU — ₹99/mo\n**Premium** — 8GB • 80GB • 4 vCPU — ₹149/mo\n**Pro** — 12GB • 120GB • 6 vCPU — ₹199/mo\n**Elite** — 16GB • 160GB • 8 vCPU — ₹299/mo\n**Extreme** — 24GB • 240GB • 10 vCPU — ₹449/mo\n**Ultimate** — 32GB • 320GB • 12 vCPU — ₹599/mo') ]});
  if(i.commandName==='status') return i.reply({embeds:[new EmbedBuilder().setColor(0x22c55e).setTitle('☁️ Anime Cloud Status').setDescription('🟢 Discord Bot — Online\n🟢 Order System — Operational\n🟢 Invoice System — Operational\n🟢 Ticket System — Operational\n🟢 VPS Control — API-ready') ]});
  if(i.commandName==='profile'){const u=db.users?.[i.user.id]||{orders:0};return i.reply(`👤 **${i.user.username}**\nOrders: **${u.orders||0}**\nWarnings: **${db.warnings[i.user.id]?.length||0}**`);}
  if(i.commandName==='coupon'){const c=i.options.getString('code').toUpperCase(), x=db.coupons[c];if(!x) return i.reply({content:'❌ Invalid coupon.',ephemeral:true});return i.reply(`🎟️ Coupon **${c}** gives **${x.percent}%** discount.`);}
  if(i.commandName==='order'){const plan=i.options.getString('plan'), note=i.options.getString('note')||'None', oid=id('ORD');db.orders[oid]={id:oid,user:i.user.id,plan,note,status:'PENDING',createdAt:new Date().toISOString()};db.users=db.users||{};db.users[i.user.id]=db.users[i.user.id]||{orders:0};db.users[i.user.id].orders++;save();return i.reply({embeds:[new EmbedBuilder().setColor(0xf59e0b).setTitle('📦 Order Created').setDescription(`Order **${oid}** is pending review.`).addFields({name:'Plan',value:plan},{name:'Note',value:note},{name:'Status',value:'🟡 PENDING'})]});}
  if(i.commandName==='invoice'){if(!admin(i)) return i.reply({content:'❌ Manage Server permission required.',ephemeral:true});await i.deferReply();const items=parseItems(i.options.getString('items')), customer=i.options.getString('customer'), time=i.options.getString('time'), status=i.options.getString('status')||'PAID', number=id('AC');const [png,pdf]=await Promise.all([makeInvoicePNG({customer,items,time,status,number}),makeInvoicePDF({customer,items,time,status,number})]);return i.editReply({content:`✅ **${number}** created • Total **${money(items.reduce((a,b)=>a+b.price,0))}**`,files:[new AttachmentBuilder(png,{name:`${number}.png`}),new AttachmentBuilder(pdf,{name:`${number}.pdf`})]});}
  if(i.commandName==='ticket'){const existing=Object.values(db.tickets).find(x=>x.user===i.user.id&&x.guild===i.guildId&&x.open);if(existing) return i.reply({content:`🎫 You already have ticket <#${existing.channel}>.`,ephemeral:true});const ch=await i.guild.channels.create({name:`ticket-${i.user.username}`.slice(0,90),type:ChannelType.GuildText,permissionOverwrites:[{id:i.guild.id,deny:[PermissionFlagsBits.ViewChannel]},{id:i.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]}]});db.tickets[ch.id]={user:i.user.id,guild:i.guildId,channel:ch.id,open:true};save();await ch.send({content:`<@${i.user.id}>`,embeds:[new EmbedBuilder().setColor(0x8b5cf6).setTitle('🎫 Anime Cloud Support').setDescription('Please describe your issue. Staff will assist you shortly.')],components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger))]});return i.reply({content:`✅ Ticket created: ${ch}`,ephemeral:true});}
  if(i.commandName==='warn'){const u=i.options.getUser('user'),r=i.options.getString('reason');db.warnings[u.id]=db.warnings[u.id]||[];db.warnings[u.id].push({moderator:i.user.id,reason:r,at:new Date().toISOString()});save();return i.reply(`⚠️ ${u} warned. Reason: **${r}**`);}
  if(i.commandName==='purge'){const n=i.options.getInteger('amount');await i.channel.bulkDelete(n,true);return i.reply({content:`🧹 Deleted ${n} messages.`,ephemeral:true});}
  if(i.commandName==='admin'){if(!admin(i)) return i.reply({content:'❌ Manage Server permission required.',ephemeral:true});const sub=i.options.getSubcommand();if(sub==='stats') return i.reply(`📊 Orders: **${Object.keys(db.orders).length}** • Tickets: **${Object.keys(db.tickets).length}** • Coupons: **${Object.keys(db.coupons).length}**`);if(sub==='broadcast') return i.channel.send(i.options.getString('message')).then(()=>i.reply({content:'✅ Broadcast sent.',ephemeral:true}));if(sub==='coupon'){const code=i.options.getString('code').toUpperCase(),percent=i.options.getInteger('percent');db.coupons[code]={percent,createdAt:new Date().toISOString()};save();return i.reply(`🎟️ Coupon **${code}** created with **${percent}%** discount.`);}}
 }catch(e){console.error(e);if(i.deferred||i.replied)return i.editReply({content:`❌ ${e.message}`});return i.reply({content:`❌ ${e.message}`,ephemeral:true});}
});
client.on('interactionCreate',async i=>{if(!i.isButton()||i.customId!=='ticket_close')return;const t=db.tickets[i.channelId];if(!t)return i.reply({content:'Ticket data not found.',ephemeral:true});if(i.user.id!==t.user&&!admin(i))return i.reply({content:'Only the ticket owner or staff can close this ticket.',ephemeral:true});t.open=false;save();await i.reply('🔒 Ticket closed.');setTimeout(()=>i.channel.delete().catch(()=>{}),2500);});
client.login(process.env.DISCORD_TOKEN);
