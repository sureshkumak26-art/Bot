const fs=require('fs');
const path=require('path');
const {Client,EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,ChannelType,PermissionFlagsBits,AttachmentBuilder}=require('discord.js');

const FILE=path.join(__dirname,'..','data','database.json');
const load=()=>fs.existsSync(FILE)?JSON.parse(fs.readFileSync(FILE,'utf8')):{};
const save=db=>fs.writeFileSync(FILE,JSON.stringify(db,null,2));
const TYPES={
 general:{label:'General Support',emoji:'🎫',env:'TICKET_GENERAL_CATEGORY_ID'},
 billing:{label:'Billing / Payment',emoji:'💳',env:'TICKET_BILLING_CATEGORY_ID'},
 vps:{label:'VPS Support',emoji:'☁️',env:'TICKET_VPS_CATEGORY_ID'},
 hosting:{label:'Domain / Hosting',emoji:'🌐',env:'TICKET_HOSTING_CATEGORY_ID'},
 technical:{label:'Technical Support',emoji:'🛠️',env:'TICKET_TECHNICAL_CATEGORY_ID'}
};
const staff=i=>!!(i.memberPermissions&&i.memberPermissions.has(PermissionFlagsBits.ManageGuild));
function typeButtons(){
 const keys=Object.keys(TYPES);
 return [0,1].map(row=>new ActionRowBuilder().addComponents(...keys.slice(row*3,row*3+3).map(k=>new ButtonBuilder().setCustomId(`ac_ticket_open:${k}`).setLabel(TYPES[k].label).setEmoji(TYPES[k].emoji).setStyle(ButtonStyle.Primary))));
}
function ticketButtons(closed=false){
 return [new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('ac_ticket_claim').setLabel('Claim').setEmoji('👋').setStyle(ButtonStyle.Primary).setDisabled(closed),
  new ButtonBuilder().setCustomId(closed?'ac_ticket_reopen':'ac_ticket_close').setLabel(closed?'Reopen':'Close').setEmoji(closed?'🔓':'🔒').setStyle(closed?ButtonStyle.Success:ButtonStyle.Danger),
  new ButtonBuilder().setCustomId('ac_ticket_transcript').setLabel('Transcript').setEmoji('📄').setStyle(ButtonStyle.Secondary)
 )];
}
async function categoryFor(guild,key){
 const envId=process.env[TYPES[key].env];
 if(envId){const c=guild.channels.cache.get(envId);if(c&&c.type===ChannelType.GuildCategory)return c;}
 const name=`Anime Cloud • ${TYPES[key].label}`;
 let c=guild.channels.cache.find(x=>x.type===ChannelType.GuildCategory&&x.name===name);
 if(c)return c;
 return guild.channels.create({name,type:ChannelType.GuildCategory,reason:'Anime Cloud ticket category'});
}
async function createTicket(i,key){
 const db=load();db.tickets=db.tickets||{};
 const id=`T-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
 const type=TYPES[key]||TYPES.general;
 const category=await categoryFor(i.guild,key);
 const overwrites=[
  {id:i.guild.roles.everyone.id,deny:[PermissionFlagsBits.ViewChannel]},
  {id:i.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.AttachFiles]},
  {id:i.client.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.ManageChannels,PermissionFlagsBits.ManageMessages]}
 ];
 if(process.env.SUPPORT_ROLE_ID)overwrites.push({id:process.env.SUPPORT_ROLE_ID,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]});
 const channel=await i.guild.channels.create({name:`ticket-${key}-${i.user.username}-${id.slice(-4)}`.toLowerCase().replace(/[^a-z0-9-]/g,'-').slice(0,90),type:ChannelType.GuildText,parent:category.id,permissionOverwrites:overwrites,reason:`Anime Cloud ${type.label} ticket`});
 db.tickets[channel.id]={id,guild:i.guild.id,user:i.user.id,channel:channel.id,type:key,typeLabel:type.label,open:true,claimedBy:null,createdAt:new Date().toISOString(),closedAt:null};save(db);
 const embed=new EmbedBuilder().setColor(0x8b5cf6).setTitle(`${type.emoji} Anime Cloud • ${type.label}`).setDescription(`Welcome <@${i.user.id}>.\n\n**Ticket ID:** \`${id}\`\n**Status:** 🟢 Open\n**Claimed:** Unclaimed\n\nPlease describe your issue with all relevant details. A staff member will assist you.`).setFooter({text:'Anime Cloud Support'}).setTimestamp();
 await channel.send({content:`<@${i.user.id}>${process.env.SUPPORT_ROLE_ID?` <@&${process.env.SUPPORT_ROLE_ID}>`:''}`,embeds:[embed],components:ticketButtons(false)});
 return channel;
}
async function transcript(channel,t){
 const messages=[];let before;
 for(let n=0;n<20;n++){
  const batch=await channel.messages.fetch({limit:100,before}).catch(()=>null);if(!batch||!batch.size)break;
  messages.push(...batch.values());if(batch.size<100)break;before=batch.last().id;
 }
 messages.sort((a,b)=>a.createdTimestamp-b.createdTimestamp);
 const lines=[`Anime Cloud Ticket Transcript`,`Ticket ID: ${t.id}`,`Type: ${t.typeLabel}`,`User: ${t.user}`,`Created: ${t.createdAt}`,`Claimed by: ${t.claimedBy||'Unclaimed'}`,`Status: ${t.open?'OPEN':'CLOSED'}`,'','--- Messages ---'];
 for(const m of messages){const text=m.content||'[attachment/embed/component]';lines.push(`[${new Date(m.createdTimestamp).toISOString()}] ${m.author.tag}: ${text}`);}
 return Buffer.from(lines.join('\n'),'utf8');
}
async function sendTranscript(i,t){
 const channel=i.channel;const buf=await transcript(channel,t);const file=new AttachmentBuilder(buf,{name:`${t.id}-transcript.txt`});
 const targetId=process.env.TICKET_TRANSCRIPT_CHANNEL_ID;const target=targetId?i.guild.channels.cache.get(targetId):null;
 if(target&&target.isTextBased())await target.send({content:`📄 Transcript • **${t.id}** • ${t.typeLabel} • <@${t.user}>`,files:[file]});
 return file;
}
async function closeTicket(i,t){
 const db=load();t.open=false;t.closedAt=new Date().toISOString();save(db);
 await sendTranscript(i,t);
 await i.channel.permissionOverwrites.edit(t.user,{ViewChannel:false,SendMessages:false}).catch(()=>{});
 if(process.env.SUPPORT_ROLE_ID)await i.channel.permissionOverwrites.edit(process.env.SUPPORT_ROLE_ID,{ViewChannel:true,SendMessages:false,ReadMessageHistory:true}).catch(()=>{});
 const embed=new EmbedBuilder().setColor(0xef4444).setTitle('🔒 Ticket Closed').setDescription(`This ticket is closed by ${i.user}.\n\nUse **Reopen** if the issue needs to continue.`).setTimestamp();
 await i.channel.send({embeds:[embed],components:ticketButtons(true)});
}
async function reopenTicket(i,t){
 const db=load();t.open=true;t.closedAt=null;save(db);
 await i.channel.permissionOverwrites.edit(t.user,{ViewChannel:true,SendMessages:true,ReadMessageHistory:true,AttachFiles:true}).catch(()=>{});
 const embed=new EmbedBuilder().setColor(0x22c55e).setTitle('🔓 Ticket Reopened').setDescription(`Ticket reopened by ${i.user}. Staff can continue assisting.`).setTimestamp();
 await i.channel.send({embeds:[embed],components:ticketButtons(false)});
}
async function handle(i){
 if(!i.guild)return false;
 if(i.isChatInputCommand()&&i.commandName==='ticket-panel'){
  if(!staff(i)){await i.reply({content:'❌ Manage Server permission required.',ephemeral:true});return true;}
  const channel=i.options.getChannel('channel')||i.channel;
  const embed=new EmbedBuilder().setColor(0x8b5cf6).setTitle('☁️ Anime Cloud Support Center').setDescription('Choose the department that best matches your issue. You can open **multiple tickets** at the same time. Each ticket is private and organized by category.').addFields(Object.entries(TYPES).map(([k,v])=>({name:`${v.emoji} ${v.label}`,value:`Open a ${v.label.toLowerCase()} ticket.`,inline:true}))).setFooter({text:'Anime Cloud • Premium Support'});
  await channel.send({embeds:[embed],components:typeButtons()});await i.reply({content:`✅ Multi-category ticket panel sent to ${channel}.`,ephemeral:true});return true;
 }
 if(!i.isButton()||!i.customId.startsWith('ac_ticket_'))return false;
 const db=load();db.tickets=db.tickets||{};
 if(i.customId.startsWith('ac_ticket_open:')){const key=i.customId.split(':')[1];const c=await createTicket(i,key);await i.reply({content:`🎫 Created **${TYPES[key].label}** ticket: ${c}`,ephemeral:true});return true;}
 const t=db.tickets[i.channelId];if(!t){await i.reply({content:'❌ Ticket record not found.',ephemeral:true});return true;}
 if(i.customId==='ac_ticket_claim'){if(!staff(i)){await i.reply({content:'❌ Staff only.',ephemeral:true});return true;}t.claimedBy=i.user.id;save(db);await i.channel.send(`👋 **Ticket claimed by ${i.user}.**`);await i.reply({content:'✅ Ticket claimed.',ephemeral:true});return true;}
 if(i.customId==='ac_ticket_close'){if(i.user.id!==t.user&&!staff(i)){await i.reply({content:'❌ You cannot close this ticket.',ephemeral:true});return true;}await i.deferReply({ephemeral:true});await closeTicket(i,t);await i.editReply('🔒 Ticket closed and transcript archived.');return true;}
 if(i.customId==='ac_ticket_reopen'){if(i.user.id!==t.user&&!staff(i)){await i.reply({content:'❌ You cannot reopen this ticket.',ephemeral:true});return true;}await i.deferReply({ephemeral:true});await reopenTicket(i,t);await i.editReply('🔓 Ticket reopened.');return true;}
 if(i.customId==='ac_ticket_transcript'){if(!staff(i)&&i.user.id!==t.user){await i.reply({content:'❌ Staff or ticket owner only.',ephemeral:true});return true;}const file=await sendTranscript(i,t);await i.reply({content:'📄 Transcript generated.',files:[file],ephemeral:true});return true;}
 return false;
}
const original=Client.prototype.emit;
Client.prototype.emit=function(event,...args){
 if(event==='interactionCreate'&&args[0]){const interaction=args[0];if((interaction.isButton&&interaction.isButton()&&interaction.customId&&interaction.customId.startsWith('ac_ticket_'))||(interaction.isChatInputCommand&&interaction.isChatInputCommand()&&interaction.commandName==='ticket-panel')){handle(interaction).catch(e=>console.error('Ticket system error:',e));return true;}}
 return original.call(this,event,...args);
};
