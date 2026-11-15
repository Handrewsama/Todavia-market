// Todavía Market Manager / Business Manager — Google Apps Script v7
// Aquest script manté les funcions del dashboard de mercats i afegeix:
// Botiga, Tallers, Clients, Factures, Factures de compra, Despeses, Caixa i PDF a Drive.

var CONFIG = {
  sheetVendes:'Vendes', sheetMercats:'Mercats', sheetProductes:'Productes', sheetBizum:'Bizum', sheetCataleg:'Catàleg',
  sheetClients:'Clients', sheetFactures:'Factures', sheetLiniesFactures:'Linies Factures', sheetVerifactu:'VERI FACTU', sheetBotiga:'Botiga',
  sheetTallers:'Tallers', sheetSessionsTallers:'Sessions Tallers', sheetDespeses:'Despeses', sheetCompres:'Compres', sheetCaixa:'Caixa', sheetEmpresa:'Empresa'
};

function doGet(e){
  var a=(e&&e.parameter&&e.parameter.action)||'';
  if(a==='getCatalogue') return getCatalogue();
  if(a==='getTallers') return getTallers();
  if(a==='getBusiness') return getBusiness();
  if(a==='getSession') return getSession();
  return jsonOk({message:'Todavía Business Manager API v7 actiu'});
}

function doPost(e){
  try{
    var data=JSON.parse(e.postData.contents||'{}'), action=data.action||'sync';
    if(data.eventId && eventExists(data.eventId)) return jsonOk({duplicate:true,eventId:data.eventId});
    if(action==='exportCatalogue') return writeCatalogue(data);
    if(action==='saveBackup') return writeBackup(data);
    if(action==='saveTaller') return writeTaller(data.taller,false);
    if(action==='exportTallers') return exportAllTallers(data);
    if(action==='syncBusiness') return syncBusiness(data);
    writeSession(data); writeVendes(data); writeProductes(data);
    if(action==='close'){writeMercats(data);writeBizum(data);clearDeviceSession(data.deviceId);}
    return jsonOk({rows:(data.products||[]).length,action:action});
  }catch(err){return jsonError(err.toString());}
}

function syncBusiness(data){
  var b=data.business||{};
  var c=b.company||{};
  writeEmpresa(c);
  writeClients(b.customers||[]);
  writeFactures(b.invoices||[]);
  writeBotiga(b.shopDays||[]);
  writeTallersArray(b.workshops||[]);
  writeDespeses(b.expenses||[]);
  writeCompres(b.purchaseInvoices||[]);
  writeCaixa(b.cash||[]);
  writeFiscalConfig(c);
  writeFiscalSummary(b);
  writeVerifactu(b);
  return jsonOk({saved:true,action:'syncBusiness',invoices:(b.invoices||[]).length,customers:(b.customers||[]).length});
}

function writeEmpresa(c){
  var sh=getOrCreateSheet(SpreadsheetApp.getActiveSpreadsheet(),CONFIG.sheetEmpresa);
  var h=['Camp','Valor']; if(sh.getLastRow()===0){sh.appendRow(h);styleHeader(sh,1,2,'#1a1a24','#f0c040');}
  var fields=['name','legalName','nif','address','postalCode','city','email','phone','iban','invoicePrefix','defaultVat','invoiceFooter','taxRegime','irpfMethod','irpfRetention','vatEnabled','vatSettlement','intraEU','sifMode','sifDefaultApplicable'];
  var labels=['Nom comercial','Raó social','NIF/CIF','Adreça','CP','Ciutat','Email','Telèfon','IBAN','Prefix factura','IVA defecte','Peu factura','Règim IVA','Mètode IRPF','Retenció IRPF %','IVA actiu','Liquidació IVA','Operacions intracomunitàries','Modalitat SIF','VERI*FACTU per defecte'];
  sh.getRange(2,1,Math.max(sh.getLastRow()-1,0),2).clearContent();
  sh.getRange(2,1,fields.length,2).setValues(fields.map(function(k,i){return [labels[i],c[k]||''];}));
  autoResize(sh,2);
}
function writeClients(arr){writeUpsert(CONFIG.sheetClients,['ID','Nom','NIF/CIF','Email','Adreça','CP','Ciutat'],arr.map(function(c){return [c.id,c.name,c.nif,c.email,c.address,c.postalCode,c.city];}),0);}
function writeFactures(arr){
  var sh=getOrCreateSheet(SpreadsheetApp.getActiveSpreadsheet(),CONFIG.sheetFactures);
  var h=['ID','Número','Data','Client','Client ID','Base (€)','IVA (€)','Total (€)','Estat','Notes','Creat','Actualitzat','Tractament IVA','SIF/VERI*FACTU','Motiu fora àmbit','Estat VERI*FACTU','Hash VERI*FACTU','PDF Drive ID','PDF Drive URL'];
  ensureHeader(sh,h);
  var rows=arr.map(function(i){var pdf=saveInvoicePdfToDrive(i);return [i.id,i.number,i.date,i.customerName,i.customerId,num(i.subtotal),num(i.tax),num(i.total),i.status||'',i.notes||'',i.createdAt||'',i.updatedAt||'',i.vatTreatment||'subjecta',i.sifApplicable===false?'Fora d\'àmbit':'VERI*FACTU',i.sifReason||'',i.verifactuStatus||'no_generat',i.verifactuHash||'',pdf.id||'',pdf.url||''];});
  upsertRows(sh,rows,0);
  var ls=getOrCreateSheet(SpreadsheetApp.getActiveSpreadsheet(),CONFIG.sheetLiniesFactures);
  ensureHeader(ls,['ID','Factura ID','Número','Descripció','Quantitat','Preu (€)','IVA %','Base (€)','IVA (€)','Total (€)']);
  var lr=[];arr.forEach(function(i){(i.lines||[]).forEach(function(l){var base=num(l.qty)*num(l.price);var iva=base*num(l.vat)/100;lr.push([uidFallback(i.id+'-'+l.description+'-'+l.qty),i.id,i.number,l.description,num(l.qty),num(l.price),num(l.vat),base,iva,base+iva]);});});
  upsertRows(ls,lr,0);
}
function writeBotiga(arr){writeUpsert(CONFIG.sheetBotiga,['ID','Data','Obert','Tancat','Obertura','Tancament','Vendes (€)','Costos (€)','Net (€)','Notes','Moviments JSON'],arr.map(function(d){return [d.id,d.date,!d.closed,d.closed,d.openedAt||'',d.closedAt||'',num(d.sales),num(d.costs),num(d.sales)-num(d.costs),d.notes||'',JSON.stringify(d.movements||[])];}),0);}
function writeTallersArray(arr){for(var i=0;i<arr.length;i++)writeTaller(arr[i],true);}
function writeDespeses(arr){writeUpsert(CONFIG.sheetDespeses,['ID','Data','Concepte','Categoria','Import (€)'],arr.map(function(x){return [x.id,x.date,x.description,x.category,num(x.amount)];}),0);}
function writeCompres(arr){writeUpsert(CONFIG.sheetCompres,['ID','Data','Proveïdor','NIF/CIF','Número factura','Base (€)','IVA %','IVA (€)','IVA deduïble (€)','Total (€)','Operació','Notes'],arr.map(function(x){return [x.id,x.date,x.supplier,x.supplierNif||'',x.number,num(x.base),num(x.vat),num(x.iva),num(x.deductibleVat),num(x.total),x.operation||'Interior',x.notes||''];}),0);}

function writeFiscalConfig(c){
  var sh=getOrCreateSheet(SpreadsheetApp.getActiveSpreadsheet(),'Fiscalitat');
  var h=['Camp','Valor']; ensureHeader(sh,h);
  var fields=['taxRegime','irpfMethod','irpfRetention','vatEnabled','vatSettlement','intraEU'];
  var labels=['Règim IVA','Mètode IRPF','Retenció IRPF %','IVA actiu','Liquidació IVA','Operacions intracomunitàries'];
  sh.getRange(2,1,Math.max(sh.getLastRow()-1,0),2).clearContent();
  sh.getRange(2,1,fields.length,2).setValues(fields.map(function(k,i){return [labels[i],c[k]===undefined?'':c[k]];}));
}
function writeFiscalSummary(b){
  var sh=getOrCreateSheet(SpreadsheetApp.getActiveSpreadsheet(),'Resum Fiscal');
  ensureHeader(sh,['ID','Any','Trimestre','IVA repercutit (€)','IVA deduïble (€)','IVA diferencial (€)','Ingressos base (€)','Despeses base (€)','Rendiment orientatiu (€)']);
  var y=new Date().getFullYear(), inv=b.invoices||[], pur=b.purchaseInvoices||[], exp=b.expenses||[];
  for(var q=1;q<=4;q++){
    var from=new Date(y,(q-1)*3,1), to=new Date(y,q*3,0,23,59,59), out=0,input=0,income=0,cost=0;
    inv.forEach(function(i){var d=new Date(i.date);if(i.status!=='cancel·lada'&&d>=from&&d<=to){out+=num(i.tax);income+=num(i.subtotal);}});
    pur.forEach(function(i){var d=new Date(i.date);if(d>=from&&d<=to){input+=num(i.deductibleVat!==undefined?i.deductibleVat:i.iva);cost+=num(i.base!==undefined?i.base:i.total/(1+num(i.vat)/100));}});
    exp.forEach(function(i){var d=new Date(i.date);if(d>=from&&d<=to)cost+=num(i.amount);});
    upsertRows(sh,[[y+'-'+q,y,q,out,input,out-input,income,cost,Math.max(0,income-cost)]],0);
  }
}

function writeVerifactu(b){
  var sh=getOrCreateSheet(SpreadsheetApp.getActiveSpreadsheet(),CONFIG.sheetVerifactu);
  ensureHeader(sh,['ID registre','Identificador VERI*FACTU','Factura ID','Factura','Data registre','NIF emissor','NIF client','Total (€)','IVA (€)','Tractament IVA','Hash anterior','Hash','Estat','Enviat','Resposta AEAT'],0);
  var arr=(b.verifactu&&b.verifactu.records)||[];
  var rows=arr.map(function(r){var p=r.payload||{};return [r.id||'',r.verifactuNumber||'',r.invoiceId||'',r.number||'',r.createdAt||'',p.issuerNif||'',p.customerNif||'',num(p.total),num(p.vat),p.vatTreatment||'',r.previousHash||'',r.hash||'',r.status||'pending',r.submittedAt||'',r.response||''];});
  upsertRows(sh,rows,0);
}

function writeCaixa(arr){writeUpsert(CONFIG.sheetCaixa,['ID','Data','Tipus','Import (€)','Concepte'],arr.map(function(x){return [x.id,x.date,x.type,num(x.amount),x.description||''];}),0);}

function saveInvoicePdfToDrive(i){
  try{
    if(!i || !i.pdfData) return {id:'',url:''};
    var props=PropertiesService.getScriptProperties();
    var folderId=props.getProperty('TODAVIA_INVOICES_FOLDER_ID');
    var folder=folderId?DriveApp.getFolderById(folderId):getOrCreateInvoiceFolder();
    var existing=findFileByName(folder,i.number+'.pdf');
    if(existing)return {id:existing.getId(),url:existing.getUrl()};
    var b64=String(i.pdfData).split(',')[1]; if(!b64)return {id:'',url:''};
    var blob=Utilities.newBlob(Utilities.base64Decode(b64),'application/pdf',i.number+'.pdf');
    var f=folder.createFile(blob);return {id:f.getId(),url:f.getUrl()};
  }catch(e){Logger.log('saveInvoicePdfToDrive: '+e);return {id:'',url:''};}
}
function getOrCreateInvoiceFolder(){var root=DriveApp.getRootFolder();var it=root.getFoldersByName('Todavía · Factures');return it.hasNext()?it.next():root.createFolder('Todavía · Factures');}
function findFileByName(folder,name){var it=folder.getFilesByName(name);return it.hasNext()?it.next():null;}

// --- Codi existent de mercats, compatible amb v6 ---
function writeBackup(data){var ss=SpreadsheetApp.getActiveSpreadsheet(),sh=getOrCreateSheet(ss,'Backups');if(sh.getLastRow()===0){var h=['Slot','Data','Mercat','Unitats','Net (€)','JSON complet'];sh.appendRow(h);styleHeader(sh,1,6,'#1a1a24','#f0c040');}var sum=data.summary||{},rows=sh.getLastRow()-1,slot=rows<3?rows+1:2;sh.getRange(slot+1,1,1,6).setValues([[slot,formatTs(data.timestamp),sum.market||'—',num(sum.units),num(sum.net),data.backup||'{}']]);return jsonOk({saved:true,sheet:'Backups'});}
function writeVendes(data){var sh=getOrCreateSheet(SpreadsheetApp.getActiveSpreadsheet(),CONFIG.sheetVendes);var h=['Timestamp','Mercat','Data','Durada (h)','Acció','Unitats','Transaccions','Ticket mitjà (€)','Ingressos bruts (€)','Cost productes (€)','Cost mercat (€)','Desplaçament (€)','Guany net (€)','Marge %','Efectiu (€)','Targeta (€)','Bizum dia (€)','Bizum any (€)','Bizum any %','Notes','Event ID'];ensureHeader(sh,h);var f=data.financials||{},m=data.market||{};sh.appendRow([formatTs(data.timestamp),m.name||'—',m.date||'—',num(m.hours),data.action||'sync',num(f.totalUnits),num(f.transactions),num(f.ticket),num(f.gross),num(f.prodCost),num(f.marketCost),num(f.travel),num(f.net),num(f.margin)+'%',num(f.cashTotal),num(f.cardTotal),num(f.bizumDay),num(f.bizumYear),num(f.bizumYearPct)+'%',m.notes||'',data.eventId||'']);}
function writeProductes(data){var sh=getOrCreateSheet(SpreadsheetApp.getActiveSpreadsheet(),CONFIG.sheetProductes);var h=['Timestamp','Mercat','Data','Emoji','Producte','Unitats','PVP (€)','Cost/ud (€)','Ingressos (€)','Cost total (€)','Benefici (€)','Marge','Stock restant','Event ID'];ensureHeader(sh,h);var m=data.market||{};(data.products||[]).forEach(function(p){if(num(p.count)===0)return;sh.appendRow([formatTs(data.timestamp),m.name||'—',m.date||'—',p.emoji||'',p.name||'—',num(p.count),num(p.pvp),num(p.cost),num(p.revenue),num(p.prodCost),num(p.profit),p.margin||'—',p.stockLeft!==undefined?p.stockLeft:'∞',data.eventId||'']);});}
function writeMercats(data){var sh=getOrCreateSheet(SpreadsheetApp.getActiveSpreadsheet(),CONFIG.sheetMercats);var h=['Data tancament','Mercat','Data','Durada (h)','Notes','Productes venuts','Unitats','Transaccions','Ticket mitjà (€)','Ingressos bruts (€)','Cost productes (€)','Cost mercat (€)','Desplaçament (€)','Guany net (€)','Marge %','Efectiu (€)','Targeta (€)','Bizum (€)','Event ID'];ensureHeader(sh,h);var f=data.financials||{},m=data.market||{},p=(data.products||[]).filter(function(x){return num(x.count)>0;});sh.appendRow([formatTs(data.timestamp),m.name||'—',m.date||'—',num(m.hours),m.notes||'',p.length,num(f.totalUnits),num(f.transactions),num(f.ticket),num(f.gross),num(f.prodCost),num(f.marketCost),num(f.travel),num(f.net),num(f.margin)+'%',num(f.cashTotal),num(f.cardTotal),num(f.bizumDay),data.eventId||'']);}
function writeBizum(data){var sh=getOrCreateSheet(SpreadsheetApp.getActiveSpreadsheet(),CONFIG.sheetBizum);var h=['Data','Any','Mercat','Bizum mercat (€)','Acumulat any (€)','% límit','Event ID'];ensureHeader(sh,h);var f=data.financials||{},m=data.market||{};sh.appendRow([formatTs(data.timestamp),new Date().getFullYear(),m.name||'—',num(f.bizumDay),num(f.bizumYear),num(f.bizumYearPct)+'%',data.eventId||'']);}
function writeSession(data){try{var sh=getOrCreateSheet(SpreadsheetApp.getActiveSpreadsheet(),'Sessió');var h=['deviceId','deviceName','Mercat','Data','Timestamp','Actiu','Unitats','Ingressos','Net','Bizum','Productes JSON'];ensureHeader(sh,h);var id=data.deviceId||'unknown',last=sh.getLastRow(),row=-1;if(last>1){var ids=sh.getRange(2,1,last-1,1).getValues();for(var i=0;i<ids.length;i++)if(String(ids[i][0])===String(id)){row=i+2;break;}}var f=data.financials||{},m=data.market||{},r=[id,data.deviceName||id,m.name||'—',m.date||'—',data.timestamp||new Date().toISOString(),'Sí',num(f.totalUnits),num(f.gross),num(f.net),num(f.bizumDay),JSON.stringify(data.products||[])];if(row>0)sh.getRange(row,1,1,r.length).setValues([r]);else sh.appendRow(r);}catch(e){Logger.log(e);}}
function getSession(){var sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sessió');if(!sh||sh.getLastRow()<2)return jsonOk({sessions:[]});return jsonOk({sessions:sh.getRange(1,1,sh.getLastRow(),11).getValues()});}
function clearDeviceSession(id){var sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sessió');if(!sh||sh.getLastRow()<2)return;var vals=sh.getRange(2,1,sh.getLastRow()-1,1).getValues();for(var i=0;i<vals.length;i++)if(String(vals[i][0])===String(id))sh.getRange(i+2,6).setValue('No');}
function writeCatalogue(data){var sh=getOrCreateSheet(SpreadsheetApp.getActiveSpreadsheet(),CONFIG.sheetCataleg);var h=['Emoji','Producte','Cost (€)','PVP (€)','Marge','Actiu','Stock inicial'];ensureHeader(sh,h);var a=data.catalogue||[];sh.getRange(2,1,Math.max(sh.getLastRow()-1,0),7).clearContent();if(a.length)sh.getRange(2,1,a.length,7).setValues(a.map(function(p){return [p.emoji||'',p.name||'',num(p.cost),num(p.pvp),p.margin||'',p.active?'Sí':'No',p.stockInitial===null||p.stockInitial===undefined?'∞':p.stockInitial];}));return jsonOk({saved:a.length});}
function getCatalogue(){try{var sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.sheetCataleg);if(!sh||sh.getLastRow()<2)return jsonOk({products:[]});var rows=sh.getRange(2,1,sh.getLastRow()-1,7).getValues();return jsonOk({products:rows.filter(function(r){return String(r[1]).trim();}).map(function(r){return {emoji:String(r[0]||''),name:String(r[1]),cost:num(r[2]),pvp:num(r[3]),margin:String(r[4]||''),active:String(r[5]).toLowerCase()!=='no',stockInitial:String(r[6])==='∞'?null:num(r[6])};})});}catch(e){return jsonError(e.toString());}}
function writeTaller(t,skip){try{var sh=getOrCreateSheet(SpreadsheetApp.getActiveSpreadsheet(),CONFIG.sheetTallers);var h=['ID','Nom','Pax min','Pax max','PVP/pax (€)','Cost mat/pax (€)','Cost fix (€)','Descripció','Sessions','Net acumulat (€)','Creat','Actualitzat'];ensureHeader(sh,h);var net=(t.sessions||[]).reduce(function(s,x){return s+num(x.net)},0);upsertRows(sh,[[t.id,t.name,num(t.paxMin),num(t.paxMax),num(t.pricePerPax||t.pvp),num(t.costMatPerPax||t.costMat),num(t.costFix),t.desc||'',(t.sessions||[]).length,net,t.createdAt||'',t.updatedAt||new Date().toISOString()]],0);var ls=getOrCreateSheet(SpreadsheetApp.getActiveSpreadsheet(),CONFIG.sheetSessionsTallers);ensureHeader(ls,['ID','Taller ID','Taller','Data','Nom sessió','Participants','Ingressos (€)','Costos (€)','Net (€)','Marge %']);var rows=(t.sessions||[]).map(function(s){return [s.id,t.id,t.name,s.date,s.name,num(s.pax),num(s.gross),num(s.cost),num(s.net),num(s.margin)+'%'];});upsertRows(ls,rows,0);if(!skip)return jsonOk({saved:true});}catch(e){if(!skip)return jsonError(e.toString());}}
function exportAllTallers(data){writeTallersArray(data.tallers||[]);return jsonOk({exported:(data.tallers||[]).length});}
function getTallers(){try{var sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.sheetTallers);if(!sh||sh.getLastRow()<2)return jsonOk({tallers:[]});var r=sh.getRange(2,1,sh.getLastRow()-1,12).getValues();return jsonOk({tallers:r.filter(function(x){return x[0];}).map(function(x){return {id:String(x[0]),name:String(x[1]),paxMin:num(x[2]),paxMax:num(x[3]),pricePerPax:num(x[4]),costMatPerPax:num(x[5]),costFix:num(x[6]),desc:String(x[7]||''),sessions:[]};})});}catch(e){return jsonError(e.toString());}}
function getBusiness(){return jsonOk({message:'Useu syncBusiness per enviar dades completes del dispositiu.'});}

// --- Utils ---
function ensureHeader(sh,h){if(sh.getLastRow()===0){sh.appendRow(h);styleHeader(sh,1,h.length,'#1a1a24','#f0c040');sh.setFrozenRows(1);return;}var existing=sh.getRange(1,1,1,Math.max(sh.getLastColumn(),h.length)).getValues()[0].map(String);for(var i=0;i<h.length;i++)if(existing.indexOf(h[i])<0)sh.getRange(1,sh.getLastColumn()+1).setValue(h[i]);}
function upsertRows(sh,rows,idCol){if(!rows.length)return;var last=sh.getLastRow(),existing={};if(last>1){var ids=sh.getRange(2,idCol+1,last-1,1).getValues();ids.forEach(function(r,i){if(r[0]!==''&&r[0]!==null)existing[String(r[0])]=i+2;});}rows.forEach(function(r){var id=String(r[idCol]||'');if(existing[id])sh.getRange(existing[id],1,1,r.length).setValues([r]);else sh.appendRow(r);});}
function getOrCreateSheet(ss,n){return ss.getSheetByName(n)||ss.insertSheet(n)}
function styleHeader(sh,row,cols,bg,fg){sh.getRange(row,1,1,cols).setFontWeight('bold').setBackground(bg).setFontColor(fg);}
function autoResize(sh,cols){try{sh.autoResizeColumns(1,cols)}catch(e){}}
function formatTs(ts){try{return Utilities.formatDate(new Date(ts),Session.getScriptTimeZone(),'dd/MM/yyyy HH:mm')}catch(e){return ts||''}}
function num(v){var n=parseFloat(v);return isNaN(n)?0:n}
function jsonOk(x){return ContentService.createTextOutput(JSON.stringify(Object.assign({status:'ok'},x||{}))).setMimeType(ContentService.MimeType.JSON)}
function jsonError(m){return ContentService.createTextOutput(JSON.stringify({status:'error',message:String(m)})).setMimeType(ContentService.MimeType.JSON)}
function eventExists(id){if(!id)return false;try{var ss=SpreadsheetApp.getActiveSpreadsheet();var names=[CONFIG.sheetVendes,CONFIG.sheetMercats,CONFIG.sheetProductes,CONFIG.sheetBizum];for(var s=0;s<names.length;s++){var sh=ss.getSheetByName(names[s]);if(!sh||sh.getLastRow()<2)continue;var h=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String),c=h.indexOf('Event ID');if(c<0)continue;var v=sh.getRange(2,c+1,sh.getLastRow()-1,1).getValues();for(var i=0;i<v.length;i++)if(String(v[i][0])===String(id))return true;}}catch(e){}return false}
function uidFallback(s){return 'line_'+Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5,s)).slice(0,20)}
