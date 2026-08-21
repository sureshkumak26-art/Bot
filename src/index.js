require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const sharp = require('sharp');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const commands = [
  new SlashCommandBuilder().setName('invoice').setDescription('Create a professional Anime Cloud invoice')
    .addStringOption(o => o.setName('customer').setDescription('Customer name').setRequired(true))
    .addStringOption(o => o.setName('items').setDescription('Multiple items: Name=Price, Name=Price').setRequired(true))
    .addStringOption(o => o.setName('time').setDescription('Billing/service time').setRequired(true))
    .addAttachmentOption(o => o.setName('image').setDescription('Optional customer/logo image').setRequired(false))
    .addStringOption(o => o.setName('status').setDescription('Payment status').addChoices({name:'PAID',value:'PAID'},{name:'PENDING',value:'PENDING'}).setRequired(false))
].map(c => c.toJSON());

function parseItems(raw) {
  const items = raw.split(',').map(x => x.trim()).filter(Boolean).map(x => {
    const i = x.lastIndexOf('=');
    if (i < 1) throw new Error('Use Name=Price format. Example: Anime VPS=750, Domain=1200');
    const name = x.slice(0, i).trim();
    const price = Number(x.slice(i + 1).replace(/[^0-9.]/g, ''));
    if (!name || !Number.isFinite(price) || price < 0) throw new Error('Invalid item or price.');
    return { name, price };
  });
  if (!items.length) throw new Error('Add at least one item.');
  if (items.length > 50) throw new Error('Maximum 50 items per invoice.');
  return items;
}
function money(n) { return `₹${n.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`; }
function invoiceNo() { return `AC-${Date.now().toString().slice(-8)}`; }
function escapeXml(s){return String(s).replace(/[<>&'\"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','\"':'&quot;'}[c]));}

async function makeInvoiceImage({ customer, items, time, status, number }) {
  const W=1400, H=Math.max(900, 430 + items.length*105);
  const rows = items.map((it,i)=>`<text x="120" y="${470+i*105}" class="item">${escapeXml(it.name)}</text><text x="1280" y="${470+i*105}" class="price" text-anchor="end">${money(it.price)}</text>`).join('');
  const total=items.reduce((a,b)=>a+b.price,0);
  const lineY=505+items.length*105;
  const totalY=580+items.length*105;
  const svg=`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#090b18"/><stop offset="1" stop-color="#17102b"/></linearGradient><linearGradient id="a"><stop stop-color="#62d9ff"/><stop offset="1" stop-color="#a66cff"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="1250" cy="100" r="260" fill="#6c5ce7" opacity=".10"/><circle cx="150" cy="850" r="300" fill="#24c7ff" opacity=".07"/><rect x="55" y="55" width="1290" height="${H-110}" rx="34" fill="#ffffff" opacity=".045" stroke="#ffffff" stroke-opacity=".12"/><text x="120" y="150" class="brand">ANIME CLOUD</text><text x="120" y="205" class="tag">PREMIUM CLOUD • VPS • DOMAINS • HOSTING</text><text x="1280" y="150" class="invoice" text-anchor="end">INVOICE</text><text x="1280" y="195" class="meta" text-anchor="end">${number}</text><line x1="120" y1="260" x2="1280" y2="260" stroke="#ffffff" stroke-opacity=".15"/><text x="120" y="320" class="label">BILLED TO</text><text x="120" y="360" class="customer">${escapeXml(customer)}</text><text x="700" y="320" class="label">SERVICE TIME</text><text x="700" y="360" class="customer">${escapeXml(time)}</text><text x="120" y="425" class="label">ITEM</text><text x="1280" y="425" class="label" text-anchor="end">AMOUNT</text>${rows}<line x1="120" y1="${lineY}" x2="1280" y2="${lineY}" stroke="#ffffff" stroke-opacity=".15"/><text x="900" y="${totalY}" class="totalLabel">TOTAL</text><text x="1280" y="${totalY}" class="total" text-anchor="end">${money(total)}</text><rect x="120" y="${totalY+55}" width="190" height="58" rx="29" fill="url(#a)"/><text x="215" y="${totalY+94}" class="status" text-anchor="middle">${status}</text><text x="120" y="${totalY+180}" class="footer">Thank you for choosing Anime Cloud.</text><text x="120" y="${totalY+215}" class="small">Professional digital invoice • ${items.length} item${items.length===1?'':'s'}.</text><style>.brand{font:700 46px Arial;fill:#fff;letter-spacing:4px}.tag{font:500 17px Arial;fill:#9ea8c7;letter-spacing:2px}.invoice{font:700 42px Arial;fill:#fff;letter-spacing:3px}.meta,.label,.small{font:500 18px Arial;fill:#929bb8}.label{font-size:16px;letter-spacing:2px}.customer{font:600 27px Arial;fill:#fff}.item{font:500 25px Arial;fill:#f5f7ff}.price{font:600 25px Arial;fill:#dce7ff}.totalLabel{font:600 25px Arial;fill:#aeb8d4}.total{font:700 42px Arial;fill:#fff}.status{font:700 20px Arial;fill:#07111c}.footer{font:600 21px Arial;fill:#cbd4ed}</style></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
function makePDF({customer,items,time,status,number}){
  return new Promise((resolve,reject)=>{const doc=new PDFDocument({size:'A4',margin:45});const chunks=[];doc.on('data',c=>chunks.push(c));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);const total=items.reduce((a,b)=>a+b.price,0);doc.rect(0,0,595,842).fill('#0b0d19');doc.fillColor('#ffffff').fontSize(25).text('ANIME CLOUD',55,55);doc.fillColor('#9ea8c7').fontSize(9).text('PREMIUM CLOUD • VPS • DOMAINS • HOSTING',55,88);doc.fillColor('#ffffff').fontSize(24).text('INVOICE',400,55,{align:'right'});doc.fillColor('#9ea8c7').fontSize(9).text(number,400,88,{align:'right'});doc.moveTo(55,125).lineTo(540,125).stroke('#30364e');doc.fillColor('#8f99b7').fontSize(9).text('BILLED TO',55,155);doc.fillColor('#fff').fontSize(14).text(customer,55,173);doc.fillColor('#8f99b7').fontSize(9).text('SERVICE TIME',330,155);doc.fillColor('#fff').fontSize(14).text(time,330,173);let y=225;doc.fillColor('#8f99b7').fontSize(9).text('ITEM',55,y);doc.text('AMOUNT',430,y,{width:110,align:'right'});y+=28;items.forEach(it=>{doc.fillColor('#f5f7ff').fontSize(12).text(it.name,55,y,{width:350});doc.text(money(it.price),430,y,{width:110,align:'right'});y+=32;});doc.moveTo(55,y+5).lineTo(540,y+5).stroke('#30364e');doc.fillColor('#aeb8d4').fontSize(12).text('TOTAL',350,y+28);doc.fillColor('#fff').fontSize(22).text(money(total),430,y+25,{width:110,align:'right'});doc.fillColor('#62d9ff').roundedRect(55,y+80,100,28,14).fill();doc.fillColor('#07111c').fontSize(10).text(status,55,y+89,{width:100,align:'center'});doc.fillColor('#9ea8c7').fontSize(9).text('Thank you for choosing Anime Cloud.',55,760);doc.end();});}

client.once('ready', async()=>{const rest=new REST({version:'10'}).setToken(process.env.DISCORD_TOKEN);await rest.put(Routes.applicationCommands(client.user.id),{body:commands});console.log(`Logged in as ${client.user.tag}`);});
client.on('interactionCreate', async interaction=>{if(!interaction.isChatInputCommand()||interaction.commandName!=='invoice')return;await interaction.deferReply();try{const items=parseItems(interaction.options.getString('items'));const customer=interaction.options.getString('customer');const time=interaction.options.getString('time');const status=interaction.options.getString('status')||'PAID';const number=invoiceNo();const att=interaction.options.getAttachment('image');let imagePath=null;if(att){const r=await fetch(att.url);const b=Buffer.from(await r.arrayBuffer());imagePath=path.join('/tmp',`invoice-upload-${Date.now()}`);fs.writeFileSync(imagePath,b);}const png=await makeInvoiceImage({customer,items,time,status,number});const pdf=await makePDF({customer,items,time,status,number});await interaction.editReply({content:`**Invoice ${number} created successfully.**\nItems: **${items.length}**\nTotal: **${money(items.reduce((a,b)=>a+b.price,0))}**`,files:[new AttachmentBuilder(png,{name:`${number}.png`}),new AttachmentBuilder(pdf,{name:`${number}.pdf`})]});if(imagePath)fs.unlinkSync(imagePath);}catch(e){await interaction.editReply({content:`❌ ${e.message}`});}});
client.login(process.env.DISCORD_TOKEN);
