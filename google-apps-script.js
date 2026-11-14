// ═══════════════════════════════════════════════════════════════════
//  MARKET DASHBOARD — Google Apps Script v6
//  Pega aquest codi a: Google Sheets → Extensiones → Apps Script
//  Implementar → Nova implementació → App web
//  Accés: "Cualquier persona" (NO "con cuenta de Google")
// ═══════════════════════════════════════════════════════════════════

var CONFIG = {
  sheetVendes:    'Vendes',
  sheetMercats:   'Mercats',
  sheetProductes: 'Productes',
  sheetBizum:     'Bizum',
  sheetCataleg:   'Catàleg',
};

// ── ENTRY POINTS ─────────────────────────────────────────────────────
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : '';
  if (action === 'getCatalogue') return getCatalogue();
  if (action === 'getSession')   return getSession();
  if (action === 'getTallers')   return getTallers();
  return jsonOk({ message: 'Market Dashboard API actiu' });
}

function doPost(e) {
  try {
    var data   = JSON.parse(e.postData.contents);
    var action = data.action || 'sync';

    // Idempotència: si el mòbil reintenta una petició offline, no dupliquem files.
    if (data.eventId && eventExists(data.eventId)) {
      return jsonOk({ duplicate: true, eventId: data.eventId });
    }

    if (action === 'exportCatalogue') return writeCatalogue(data);
    if (action === 'saveBackup')      return writeBackup(data);
    if (action === 'saveTaller')      return writeTaller(data.taller, false);
    if (action === 'exportTallers')   return exportAllTallers(data);

    writeSession(data);
    writeVendes(data);
    writeProductes(data);

    if (action === 'close') {
      writeMercats(data);
      writeBizum(data);
      clearDeviceSession(data.deviceId);
    }

    return jsonOk({ rows: (data.products || []).length, action: action });
  } catch (err) {
    return jsonError(err.toString());
  }
}

// ── WRITE: BACKUPS (rotació de 3 slots) ──────────────────────────────
function writeBackup(data) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateSheet(ss, 'Backups');
    var MAX   = 3;

    // Crear capçalera si cal
    if (sheet.getLastRow() === 0) {
      var hdr = ['Slot', 'Data', 'Mercat', 'Unitats', 'Net (€)', 'JSON complet'];
      sheet.appendRow(hdr);
      styleHeader(sheet, 1, 6, '#1a1a24', '#f0c040');
      sheet.setFrozenRows(1);
      sheet.setColumnWidth(6, 60); // la columna JSON és ampla però no cal veure-la
    }

    var sum  = data.summary || {};
    var ts   = formatTs(data.timestamp);
    var json = data.backup || '{}';

    // Llegir files de dades actuals (ignorant capçalera)
    var lastRow = sheet.getLastRow();
    var dataRows = lastRow - 1; // files de dades (sense capçalera)

    if (dataRows < MAX) {
      // Encara no hem arribat a MAX — afegir
      var newSlot = dataRows + 1;
      sheet.appendRow([newSlot, ts, sum.market||'—', num(sum.units), num(sum.net), json]);
    } else {
      // Ja tenim MAX files — sobreescriure la més antiga (rotació circular)
      // Cercar la fila amb el timestamp més antic
      var vals = sheet.getRange(2, 1, dataRows, 2).getValues();
      var oldestRow = 2;
      var oldestDate = new Date(vals[0][1] || 0);
      for (var i = 1; i < vals.length; i++) {
        var d = new Date(vals[i][1] || 0);
        if (d < oldestDate) { oldestDate = d; oldestRow = i + 2; }
      }
      var slot = sheet.getRange(oldestRow, 1).getValue();
      sheet.getRange(oldestRow, 1, 1, 6).setValues([[
        slot, ts, sum.market||'—', num(sum.units), num(sum.net), json
      ]]);
    }

    autoResize(sheet, 5); // no redimensionar la columna JSON
    return jsonOk({ saved: true, sheet: 'Backups' });
  } catch (err) {
    return jsonError('writeBackup: ' + err.toString());
  }
}

// ── WRITE: VENDES ─────────────────────────────────────────────────────
// Camps que envia el dashboard (versió 19):
// financials: gross, prodCost, marketCost, travel, net, margin,
//             totalUnits, ticket, transactions, cashTotal, cardTotal,
//             bizumDay, bizumYear, bizumYearPct
// market: name, date, hours, paid, fee, travel, notes, caixaInicial
function writeVendes(data) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet(ss, CONFIG.sheetVendes);
  if (sheet.getLastRow() === 0) {
    var hdr = ['Timestamp','Mercat','Data','Durada (h)','Acció','Unitats','Transaccions','Ticket mitjà (€)','Ingressos bruts (€)','Cost productes (€)','Cost mercat (€)','Desplaçament (€)','Guany net (€)','Marge %','Efectiu (€)','Targeta (€)','Bizum dia (€)','Bizum any (€)','Bizum any %','Notes','Event ID'];
    sheet.appendRow(hdr); styleHeader(sheet,1,hdr.length,'#1a1a24','#f0c040'); sheet.setFrozenRows(1);
  } else { ensureColumn(sheet,'Event ID'); }
  var f=data.financials||{}, m=data.market||{};
  sheet.appendRow([
    formatTs(data.timestamp),m.name||'—',m.date||'—',num(m.hours),data.action||'sync',num(f.totalUnits),num(f.transactions),num(f.ticket),num(f.gross),num(f.prodCost),num(f.marketCost),num(f.travel),num(f.net),num(f.margin)+'%',num(f.cashTotal),num(f.cardTotal),num(f.bizumDay),num(f.bizumYear),num(f.bizumYearPct)+'%',m.notes||'',data.eventId||''
  ]);
  autoResize(sheet,21);
}

// ── WRITE: PRODUCTES ──────────────────────────────────────────────────
// Camps que envia el dashboard per producte:
// emoji, name, count, pvp, cost, revenue, prodCost, profit, margin, stockLeft
function writeProductes(data) {
  var ss=SpreadsheetApp.getActiveSpreadsheet(), sheet=getOrCreateSheet(ss,CONFIG.sheetProductes);
  if(sheet.getLastRow()===0){
    var hdr=['Timestamp','Mercat','Data','Emoji','Producte','Unitats','PVP (€)','Cost/ud (€)','Ingressos (€)','Cost total (€)','Benefici (€)','Marge','Stock restant','Event ID'];
    sheet.appendRow(hdr); styleHeader(sheet,1,hdr.length,'#1a1a24','#3ecf8e'); sheet.setFrozenRows(1);
  } else { ensureColumn(sheet,'Event ID'); }
  var ts=formatTs(data.timestamp), m=data.market||{}, hasRows=false;
  (data.products||[]).forEach(function(p){
    if(num(p.count)===0)return;
    sheet.appendRow([ts,m.name||'—',m.date||'—',p.emoji||'',p.name||'—',num(p.count),num(p.pvp),num(p.cost),num(p.revenue),num(p.prodCost),num(p.profit),p.margin||'—',p.stockLeft!==undefined?p.stockLeft:'∞',data.eventId||'']); hasRows=true;
  });
  if(hasRows)autoResize(sheet,14);
}

// ── WRITE: MERCATS ────────────────────────────────────────────────────
function writeMercats(data) {
  var ss=SpreadsheetApp.getActiveSpreadsheet(), sheet=getOrCreateSheet(ss,CONFIG.sheetMercats);
  if(sheet.getLastRow()===0){
    var hdr=['Data tancament','Mercat','Data','Durada (h)','Notes','Productes venuts','Unitats','Transaccions','Ticket mitjà (€)','Ingressos bruts (€)','Cost productes (€)','Cost mercat (€)','Desplaçament (€)','Guany net (€)','Marge %','Efectiu (€)','Targeta (€)','Bizum (€)','Event ID'];
    sheet.appendRow(hdr); styleHeader(sheet,1,hdr.length,'#1a1a24','#a78bfa'); sheet.setFrozenRows(1);
  } else { ensureColumn(sheet,'Event ID'); }
  var f=data.financials||{},m=data.market||{},prods=(data.products||[]).filter(function(p){return num(p.count)>0;});
  sheet.appendRow([formatTs(data.timestamp),m.name||'—',m.date||'—',num(m.hours),m.notes||'',prods.length,num(f.totalUnits),num(f.transactions),num(f.ticket),num(f.gross),num(f.prodCost),num(f.marketCost),num(f.travel),num(f.net),num(f.margin)+'%',num(f.cashTotal),num(f.cardTotal),num(f.bizumDay),data.eventId||'']);
  autoResize(sheet,19);
}

// ── WRITE: BIZUM ──────────────────────────────────────────────────────
function writeBizum(data) {
  var ss=SpreadsheetApp.getActiveSpreadsheet(), sheet=getOrCreateSheet(ss,CONFIG.sheetBizum);
  if(sheet.getLastRow()===0){
    var hdr=['Data','Any','Mercat','Bizum mercat (€)','Acumulat any (€)','% límit (2.500€)','Event ID'];
    sheet.appendRow(hdr); styleHeader(sheet,1,hdr.length,'#1a1a24','#a78bfa'); sheet.setFrozenRows(1);
  } else { ensureColumn(sheet,'Event ID'); }
  var f=data.financials||{},m=data.market||{};
  sheet.appendRow([formatTs(data.timestamp),new Date().getFullYear(),m.name||'—',num(f.bizumDay),num(f.bizumYear),num(f.bizumYearPct)+'%',data.eventId||'']); autoResize(sheet,7);
}

// ── WRITE/READ: SESSIÓ DE DISPOSITIUS (per supervisor) ───────────────
// Full "Sessió": una fila per dispositiu, actualitzada a cada sync.
// El supervisor llegeix aquest full per consolidar dades.

function writeSession(data) {
  try {
    var ss      = SpreadsheetApp.getActiveSpreadsheet();
    var sheet   = getOrCreateSheet(ss, 'Sessió');
    var deviceId = data.deviceId || 'unknown';
    var f        = data.financials || {};
    var m        = data.market     || {};
    var ts       = data.timestamp  || new Date().toISOString();

    // Capçalera si cal
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'deviceId','deviceName','Mercat','Data','Timestamp','Actiu',
        'Unitats','Ingressos','Net','Bizum',
        'Productes (JSON)',
      ]);
      styleHeader(sheet, 1, 11, '#1a1a24', '#4a9eff');
      sheet.setFrozenRows(1);
    }

    // Buscar fila existent d'aquest dispositiu
    var lastRow   = sheet.getLastRow();
    var existRow  = -1;
    if (lastRow > 1) {
      var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        if (String(ids[i][0]) === String(deviceId)) { existRow = i + 2; break; }
      }
    }

    var prodsJson = JSON.stringify((data.products || []).map(function(p){
      return { emoji:p.emoji, name:p.name, count:num(p.count), revenue:num(p.revenue) };
    }));

    var rowData = [
      deviceId,
      data.deviceName || deviceId,
      m.name  || '—',
      m.date   || '—',
      ts,
      'Sí',
      num(f.totalUnits),
      num(f.gross),
      num(f.net),
      num(f.bizumDay),
      prodsJson,
    ];

    if (existRow > 0) {
      sheet.getRange(existRow, 1, 1, rowData.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }
  } catch(e) {
    // No bloquejar el flux principal si falla
    console.log('writeSession error: ' + e.toString());
  }
}

function clearDeviceSession(deviceId) {
  try {
    if (!deviceId) return;
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Sessió');
    if (!sheet || sheet.getLastRow() < 2) return;
    var ids = sheet.getRange(2, 1, sheet.getLastRow()-1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(deviceId)) {
        sheet.getRange(i+2, 6, 1, 1).setValue('No'); // Actiu = No
        break;
      }
    }
  } catch(e) {}
}

function getSession() {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Sessió');
    if (!sheet || sheet.getLastRow() < 2) {
      return jsonOk({ devices: [] });
    }

    var rows    = sheet.getRange(2, 1, sheet.getLastRow()-1, 11).getValues();
    var devices = [];
    var cutoff  = new Date(Date.now() - 4 * 60 * 60 * 1000); // últimes 4 hores

    rows.forEach(function(row) {
      var deviceId   = String(row[0]).trim();
      var deviceName = String(row[1]).trim();
      var market     = String(row[2]).trim();
      var date       = String(row[3]).trim();
      var ts         = String(row[4]).trim();
      var active     = String(row[5]).trim();
      var units      = num(row[6]);
      var gross      = num(row[7]);
      var net        = num(row[8]);
      var bizumDay   = num(row[9]);
      var prodsRaw   = String(row[10]).trim();

      if (!deviceId || deviceId === 'deviceId') return; // saltar capçalera

      // Excloure dispositius inactius o amb dades molt antigues
      try {
        var d = new Date(ts);
        if (d < cutoff) return;
      } catch(e) {}

      var products = [];
      try { products = JSON.parse(prodsRaw); } catch(e) {}

      devices.push({
        deviceId, deviceName, market, date, ts, active,
        units, gross, net, bizumDay, products,
      });
    });

    return jsonOk({ devices: devices });
  } catch(err) {
    return jsonError('getSession: ' + err.toString());
  }
}

// Camps que envia el dashboard: emoji, name, cost, pvp, margin, active, stockInitial
function writeCatalogue(data) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateSheet(ss, CONFIG.sheetCataleg);

    sheet.clear(); // esborra contingut i format

    var hdr = [
      'Emoji', 'Nom', 'Cost (€)', 'PVP (€)', 'Marge',
      'Actiu', 'Stock inicial', 'Última actualització',
    ];
    sheet.appendRow(hdr);
    styleHeader(sheet, 1, hdr.length, '#1a1a24', '#4a9eff');
    sheet.setFrozenRows(1);

    var ts   = formatTs(data.timestamp);
    var cats = data.catalogue || [];

    cats.forEach(function(p) {
      sheet.appendRow([
        p.emoji          || '📦',
        p.name           || '',
        num(p.cost),
        num(p.pvp),
        p.margin         || '—',
        p.active         || 'Sí',
        p.stockInitial !== '∞' ? num(p.stockInitial) : '∞',
        ts,
      ]);
    });

    if (cats.length > 0) {
      sheet.getRange(2, 3, cats.length, 2).setNumberFormat('0.00');
    }
    autoResize(sheet, 8);

    return jsonOk({ exported: cats.length, sheet: CONFIG.sheetCataleg });
  } catch (err) {
    return jsonError('writeCatalogue: ' + err.toString());
  }
}

// ── GET CATALOGUE (import al dashboard) ──────────────────────────────
function getCatalogue() {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(CONFIG.sheetCataleg);

    if (!sheet) {
      // Crear el full amb exemple si no existeix
      sheet = ss.insertSheet(CONFIG.sheetCataleg);
      var hdr = ['Emoji','Nom','Cost (€)','PVP (€)','Marge','Actiu','Stock inicial','Última actualització'];
      sheet.appendRow(hdr);
      styleHeader(sheet, 1, 8, '#1a1a24', '#4a9eff');
      sheet.appendRow(['🍎','Exemple Manzana',0.30,1.20,'75%','Sí','∞','']);
      autoResize(sheet, 8);
      return jsonOk({ products: [], message: 'Full Catàleg creat. Afegeix productes i torna a importar.' });
    }

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return jsonOk({ products: [], message: 'El full Catàleg és buit' });
    }

    var rows    = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
    var headers = rows[0].map(function(h) { return h.toString().trim().toLowerCase(); });

    var col = {
      emoji:  findCol(headers, ['emoji']),
      name:   findCol(headers, ['nom','name','producte','product']),
      cost:   findCol(headers, ['cost (€)','cost(€)','cost']),
      pvp:    findCol(headers, ['pvp (€)','pvp(€)','pvp','preu','price']),
      active: findCol(headers, ['actiu','active','activo']),
      stock:  findCol(headers, ['stock inicial','stock','estoc']),
    };

    var products = [];
    for (var i = 1; i < rows.length; i++) {
      var row  = rows[i];
      var name = col.name >= 0 ? String(row[col.name]).trim() : '';
      if (!name) continue;

      // Saltar files marcades com a inactives
      if (col.active >= 0) {
        var activeVal = String(row[col.active]).trim().toLowerCase();
        if (activeVal === 'no') continue;
      }

      var stockRaw = col.stock >= 0 ? String(row[col.stock]).trim() : '∞';
      var stockNum = (stockRaw === '' || stockRaw === '∞' || isNaN(parseInt(stockRaw))) ? null : parseInt(stockRaw);

      products.push({
        emoji: col.emoji >= 0 ? String(row[col.emoji]).trim() || '📦' : '📦',
        name:  name,
        cost:  col.cost >= 0 ? parseFloat(row[col.cost]) || 0 : 0,
        pvp:   col.pvp  >= 0 ? parseFloat(row[col.pvp])  || 0 : 0,
        stockInitial: stockNum,
      });
    }

    return jsonOk({ products: products });
  } catch (err) {
    return jsonError('getCatalogue: ' + err.toString());
  }
}

// ── TALLERS ──────────────────────────────────────────────────────────

function writeTaller(t, skipReturn) {
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateSheet(spreadsheet, 'Tallers');
    if (sheet.getLastRow() === 0) {
      var hdr = ['ID','Nom','Pax min','Pax max','PVP/pax (€)','Preu total (€)',
                 'Mode preu','Cost mat/pax (€)','Cost fix (€)','Guany desitjat (€)',
                 'Descripcio','Sessions','Net acumulat (€)','Creat','Actualitzat'];
      sheet.appendRow(hdr);
      styleHeader(sheet, 1, hdr.length, '#1a1a24', '#a78bfa');
      sheet.setFrozenRows(1);
    }
    var lastRow  = sheet.getLastRow();
    var existRow = -1;
    if (lastRow > 1) {
      var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        if (String(ids[i][0]) === String(t.id)) { existRow = i + 2; break; }
      }
    }
    var sessions = t.sessions || [];
    var totalNet = 0;
    for (var k = 0; k < sessions.length; k++) { totalNet += num(sessions[k].net); }

    var rowData = [
      t.id          || '',
      t.name        || '',
      num(t.paxMin),
      num(t.paxMax),
      num(t.pvp),
      num(t.priceTotal),
      t.priceMode   || 'total',
      num(t.costMat),
      num(t.costFix),
      num(t.guanyDesitjat),
      t.desc        || '',
      sessions.length,
      totalNet.toFixed(2),
      t.createdAt   ? formatTs(t.createdAt) : '',
      t.updatedAt   ? formatTs(t.updatedAt) : formatTs(new Date().toISOString()),
    ];

    if (existRow > 0) {
      sheet.getRange(existRow, 1, 1, rowData.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }
    writeTallerSessions(spreadsheet, t);
    autoResize(sheet, 15);
    if (!skipReturn) return jsonOk({ saved: true, taller: t.name });
  } catch (err) {
    var msg = 'writeTaller: ' + err.toString();
    Logger.log(msg);
    if (!skipReturn) return jsonError(msg);
  }
}

function writeTallerSessions(spreadsheet, t) {
  try {
    var sheet = getOrCreateSheet(spreadsheet, 'Sessions Tallers');
    if (sheet.getLastRow() === 0) {
      var hdr = ['ID Sessio','Taller','Data','Nom sessio','Participants',
                 'PVP/pax (€)','Cost fix (€)','Cost mat/pax (€)',
                 'Ingressos (€)','Costos (€)','Net (€)','Marge %','Tancat'];
      sheet.appendRow(hdr);
      styleHeader(sheet, 1, hdr.length, '#1a1a24', '#3ecf8e');
      sheet.setFrozenRows(1);
    }
    var sessions = t.sessions || [];
    for (var i = 0; i < sessions.length; i++) {
      var s = sessions[i];
      var lr = sheet.getLastRow();
      var exists = false;
      if (lr > 1) {
        var ids2 = sheet.getRange(2, 1, lr - 1, 1).getValues();
        for (var j = 0; j < ids2.length; j++) {
          if (String(ids2[j][0]) === String(s.id)) { exists = true; break; }
        }
      }
      if (!exists) {
        var costT = parseFloat((num(s.costFix) + num(s.pax) * num(s.costMat)).toFixed(2));
        sheet.appendRow([
          s.id       || '',
          t.name     || '',
          s.date     || '',
          s.name     || '',
          num(s.pax),
          num(s.pvp),
          num(s.costFix),
          num(s.costMat),
          num(s.gross),
          costT,
          num(s.net),
          num(s.margin) + '%',
          s.closedAt ? formatTs(s.closedAt) : '',
        ]);
      }
    }
    autoResize(sheet, 13);
  } catch(e) { Logger.log('writeTallerSessions: ' + e.toString()); }
}

function exportAllTallers(data) {
  try {
    var tal = data.tallers || [];
    if (!tal.length) return jsonOk({ exported: 0 });
    for (var i = 0; i < tal.length; i++) { writeTaller(tal[i], true); }
    return jsonOk({ exported: tal.length });
  } catch(err) { return jsonError('exportAllTallers: ' + err.toString()); }
}

function getTallers() {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Tallers');
    if (!sheet || sheet.getLastRow() < 2) {
      return jsonOk({ tallers: [], message: 'El full Tallers es buit' });
    }
    var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 15).getValues();
    var out  = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var id = String(r[0]).trim();
      if (!id) continue;
      out.push({
        id:            id,
        name:          String(r[1]).trim(),
        paxMin:        num(r[2]),
        paxMax:        num(r[3]),
        pvp:           num(r[4]),
        priceTotal:    num(r[5]),
        priceMode:     String(r[6]).trim() || 'total',
        costMat:       num(r[7]),
        costFix:       num(r[8]),
        guanyDesitjat: num(r[9]),
        desc:          String(r[10]).trim(),
        sessions:      [],
      });
    }
    return jsonOk({ tallers: out });
  } catch(err) { return jsonError('getTallers: ' + err.toString()); }
}

function testTallers() {
  var fake = { postData: { contents: JSON.stringify({
    action: 'exportTallers',
    timestamp: new Date().toISOString(),
    tallers: [{
      id:'tall-test-001', name:'Taller de Macrame',
      paxMin:4, paxMax:10, pvp:35, priceTotal:350,
      priceMode:'total', costMat:5, costFix:30, guanyDesitjat:0,
      desc:'Taller per a principiants',
      createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(),
      sessions:[{
        id:'sess-001', name:'Sessio 1', date:'2025-05-10',
        pax:8, pvp:35, costFix:30, costMat:5, gross:280, net:170, margin:60,
        closedAt:new Date().toISOString()
      }]
    }]
  })}};
  Logger.log(doPost(fake).getContent());
}

// ── UTILITATS ─────────────────────────────────────────────────────────
// ── IDEMPOTÈNCIA / MIGRACIÓ DE FULLS ────────────────────────────────
function ensureColumn(sheet, name) {
  var last=sheet.getLastColumn();
  if(last<1){sheet.getRange(1,1).setValue(name);return last+1;}
  var headers=sheet.getRange(1,1,1,last).getValues()[0].map(function(x){return String(x).trim();});
  var idx=headers.indexOf(name);
  if(idx>=0)return idx+1;
  sheet.getRange(1,last+1).setValue(name);
  return last+1;
}
function eventExists(eventId) {
  if(!eventId)return false;
  try {
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    var sheets=[CONFIG.sheetVendes,CONFIG.sheetMercats,CONFIG.sheetProductes,CONFIG.sheetBizum];
    for(var s=0;s<sheets.length;s++){
      var sh=ss.getSheetByName(sheets[s]); if(!sh||sh.getLastRow()<2)continue;
      var last=sh.getLastColumn(), headers=sh.getRange(1,1,1,last).getValues()[0].map(function(x){return String(x).trim();});
      var col=headers.indexOf('Event ID'); if(col<0)continue;
      var vals=sh.getRange(2,col+1,sh.getLastRow()-1,1).getValues();
      for(var i=0;i<vals.length;i++)if(String(vals[i][0]).trim()===String(eventId))return true;
    }
  }catch(e){ Logger.log('eventExists: '+e.toString()); }
  return false;
}

function getOrCreateSheet(ss, name) {
  var s = ss.getSheetByName(name);
  if (!s) s = ss.insertSheet(name);
  return s;
}

function styleHeader(sheet, row, cols, bg, fg) {
  sheet.getRange(row, 1, 1, cols)
    .setFontWeight('bold')
    .setBackground(bg)
    .setFontColor(fg)
    .setFontFamily('Courier New, monospace');
}

function autoResize(sheet, cols) {
  try { sheet.autoResizeColumns(1, cols); } catch(e) {}
}

function formatTs(ts) {
  if (!ts) return '';
  try {
    return Utilities.formatDate(
      new Date(ts),
      Session.getScriptTimeZone(),
      'dd/MM/yyyy HH:mm'
    );
  } catch(e) { return ts; }
}

function num(v) {
  var n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function findCol(headers, candidates) {
  for (var i = 0; i < candidates.length; i++) {
    var idx = headers.indexOf(candidates[i]);
    if (idx >= 0) return idx;
  }
  return -1;
}

function jsonOk(extra) {
  return ContentService
    .createTextOutput(JSON.stringify(Object.assign({ status: 'ok' }, extra || {})))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonError(msg) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'error', message: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── TESTS LOCALS ──────────────────────────────────────────────────────
function testSync() {
  var fake = {
    postData: {
      contents: JSON.stringify({
        action: 'close',
        sheet:  'Vendes',
        timestamp: new Date().toISOString(),
        market: { name: 'Mercat Test', date: '2025-05-10', hours: 6,
                  paid: true, fee: 20, travel: 10, notes: 'Bon dia', caixaInicial: 50 },
        financials: {
          gross: '185.50', prodCost: '62.00', marketCost: '20.00',
          travel: '10.00', net: '93.50', margin: 50, totalUnits: 47,
          transactions: 32, ticket: '5.80',
          cashTotal: '95.00', cardTotal: '45.50',
          bizumDay: '45.00', bizumYear: '320.00', bizumYearPct: '12.8',
        },
        products: [
          { emoji:'🍎', name:'Manzana', count:20, pvp:'1.20', cost:'0.30',
            revenue:'24.00', prodCost:'6.00', profit:'18.00', margin:'75%', stockLeft:30 },
          { emoji:'🍞', name:'Pa artesà', count:15, pvp:'2.50', cost:'0.80',
            revenue:'37.50', prodCost:'12.00', profit:'25.50', margin:'68%', stockLeft:'∞' },
        ]
      })
    }
  };
  Logger.log(doPost(fake).getContent());
}

function testExportCatalogue() {
  var fake = {
    postData: {
      contents: JSON.stringify({
        action: 'exportCatalogue',
        timestamp: new Date().toISOString(),
        catalogue: [
          { emoji:'🍎', name:'Manzana', cost:'0.30', pvp:'1.20', margin:'75%', active:'Sí', stockInitial:50 },
          { emoji:'🍞', name:'Pa artesà', cost:'0.80', pvp:'2.50', margin:'68%', active:'Sí', stockInitial:'∞' },
        ]
      })
    }
  };
  Logger.log(doPost(fake).getContent());
}
