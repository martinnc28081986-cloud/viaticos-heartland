(function (root) {
  // Conceptos de la planilla (hoja DATOS)
  var CONCEPTOS = ['53110 - SUMINISTROS DE OFICINA', '53200 - ENTRENAMIENTO Y SEMINARIOS', '53300 - AVION', '53310 - TAXIS Y PASAJES',
    '53315 - RENTA DE AUTOS', '53320 - PEAJES Y ESTACIONAMIENTO', '53330 - GASOLINA', '53340 - HOSPEDAJE', '53350 - COMIDAS Y ENTRETENIMIENTO',
    '53450 - GASTOS DE LOGISTICA DE ENVIO', '53500 - GASTOS MISCELANEOS', '53700 - RENTA EQUIPO', '60200 - MUESTRAS DE PRODUCTO',
    '60300 - OTROS GASTOS DE VENTAS', '60310 - OTROS GASTOS MARKETING', '63000 - ENTRENAMIENTO Y SEMINARIOS', '63200 - SUMINISTROS COMPUTADORAS',
    '63210 - CORREO', '63220 - MATERIAL DE OFICINA', '63300 - AVION', '63310 - TAXIS Y PASAJES', '63315 - RENTA DE AUTOS',
    '63320 - PEAJES Y ESTACIONAMIENTO', '63330 - GASOLINA', '63340 - HOSPEDAJE', '63350 - COMIDAS Y ENTRETENIMIENTO', '63500 - OTROS GASTOS ADMIN'];

  // Grupos principales (botones rápidos). El resto de los conceptos se elige de la lista completa.
  var PRINCIPALES = [
    { id: 'PEAJES', label: 'Peajes', icon: 'toll', concepto: '53320 - PEAJES Y ESTACIONAMIENTO' },
    { id: 'ESTACIONAMIENTO', label: 'Estacionamiento', icon: 'local_parking', concepto: '53320 - PEAJES Y ESTACIONAMIENTO' },
    { id: 'COMBUSTIBLE', label: 'Combustible', icon: 'local_gas_station', concepto: '53330 - GASOLINA' },
    { id: 'COMIDAS', label: 'Comidas', icon: 'restaurant', concepto: '53350 - COMIDAS Y ENTRETENIMIENTO' },
    { id: 'TAXIS Y PASAJES', label: 'Taxis y pasajes', icon: 'local_taxi', concepto: '53310 - TAXIS Y PASAJES' },
    { id: 'HOSPEDAJE', label: 'Hospedaje', icon: 'hotel', concepto: '53340 - HOSPEDAJE' },
    { id: 'AVION', label: 'Avión', icon: 'flight', concepto: '53300 - AVION' },
    { id: 'REPARACION DE AUTO', label: 'Reparación de auto', icon: 'build', concepto: '60300 - OTROS GASTOS DE VENTAS' }
  ];
  var ICONOS = { '53110': 'inventory', '53200': 'school', '53315': 'car_rental', '53450': 'local_shipping', '53500': 'more_horiz', '53700': 'devices',
    '60200': 'inventory_2', '60300': 'sell', '60310': 'campaign', '63': 'business_center' };
  function capital(s) { s = s.toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); }
  var GRUPOS = PRINCIPALES.slice();
  CONCEPTOS.forEach(function (c) {
    var cod = c.slice(0, 5), nom = c.slice(8);
    var label = (cod.charAt(0) === '6' && cod.slice(0, 2) === '63' ? 'Admin · ' : '') + capital(nom) + ' (' + cod + ')';
    GRUPOS.push({ id: c, label: label, icon: ICONOS[cod] || ICONOS[cod.slice(0, 2)] || 'receipt_long', concepto: c });
  });
  // compatibilidad con tickets viejos
  GRUPOS.push({ id: 'OTROS', label: 'Misceláneos (53500)', icon: 'more_horiz', concepto: '53500 - GASTOS MISCELANEOS', oculto: true });

  var MONEDAS = [
    { code: 'ARS', label: 'ARS - Argentina', simbolo: '$' }, { code: 'USD', label: 'USD - US', simbolo: 'US$' },
    { code: 'BRL', label: 'BRL - Brasil', simbolo: 'R$' }, { code: 'CLP', label: 'CLP - Chile', simbolo: 'CLP$' },
    { code: 'UYU', label: 'UYU - Uruguay', simbolo: 'UY$' }, { code: 'MXN', label: 'MXN - México', simbolo: 'MX$' },
    { code: 'COP', label: 'COP - Colombia', simbolo: 'COL$' }, { code: 'SOL', label: 'SOL - Perú', simbolo: 'S/' },
    { code: 'DOP', label: 'DOP - Dominicana', simbolo: 'RD$' }, { code: 'CRC', label: 'CRC - Costa Rica', simbolo: '₡' },
    { code: 'EUR', label: 'EUR - Euro', simbolo: '€' }
  ];
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var MESES_LARGO = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  function grupoDe(id) { for (var i = 0; i < GRUPOS.length; i++) if (GRUPOS[i].id === id) return GRUPOS[i]; return GRUPOS[GRUPOS.length - 1]; }
  function monedaDe(code) { for (var i = 0; i < MONEDAS.length; i++) if (MONEDAS[i].code === code) return MONEDAS[i]; return MONEDAS[0]; }
  function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function fmtNum(n, dec) { dec = dec == null ? 2 : dec; return (Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
  function money(n, code, dec) { return (code && code !== 'ARS' ? monedaDe(code).simbolo + ' ' : '$ ') + fmtNum(n, dec); }
  function ars(t) { var tc = (t.moneda && t.moneda !== 'ARS') ? Number(t.tc) || 0 : 1; return round2((Number(t.importe) || 0) * tc); }
  function fechaAR(iso) { if (!iso) return ''; var p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function isoToDate(iso) { var p = iso.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])); }
  function nombreArchivo(mes, ext) { var p = mes.split('-'); return 'Gastos_Martin_Castillo_' + MESES[Number(p[1]) - 1] + p[0].slice(2) + '.' + ext; }

  // Agrupa por concepto y moneda, en el orden de GRUPOS
  function agrupar(tickets) {
    var out = [];
    GRUPOS.forEach(function (g) {
      var delGrupo = tickets.filter(function (t) { return (t.grupo || 'OTROS') === g.id; });
      if (!delGrupo.length) return;
      var monedas = [];
      delGrupo.forEach(function (t) { var m = t.moneda || 'ARS'; if (monedas.indexOf(m) < 0) monedas.push(m); });
      monedas.sort(function (a, b) { return a === 'ARS' ? -1 : b === 'ARS' ? 1 : a < b ? -1 : 1; });
      monedas.forEach(function (m) {
        var ts = delGrupo.filter(function (t) { return (t.moneda || 'ARS') === m; })
          .sort(function (a, b) { return (a.fecha || '').localeCompare(b.fecha || ''); });
        var total = round2(ts.reduce(function (s, t) { return s + (Number(t.importe) || 0); }, 0));
        var totalArs = round2(ts.reduce(function (s, t) { return s + ars(t); }, 0));
        var fechas = ts.map(function (t) { return t.fecha; }).filter(Boolean).sort();
        out.push({ grupo: g, moneda: m, tickets: ts, total: total, totalArs: totalArs, ultimaFecha: fechas[fechas.length - 1] || null });
      });
    });
    return out;
  }
  // Texto de la columna de descripción del Excel
  function descripcion(g) {
    if (g.id === 'COMIDAS' || /COMIDAS Y ENTRETENIMIENTO/.test(g.id)) return 'COMIDA EN GIRA';
    return (g.id.indexOf(' - ') > 0 ? g.id.slice(8) : g.id).toUpperCase();
  }
  function numerar(grupos) { var n = 0; grupos.forEach(function (g) { g.tickets.forEach(function (t) { t._n = ++n; }); }); return n; }

  async function buildXlsx(ExcelJS, templateBuf, data) {
    var wb = new ExcelJS.Workbook();
    await wb.xlsx.load(templateBuf);
    var ws = wb.getWorksheet('REPORTE DE GASTOS');
    var grupos = agrupar(data.tickets);
    numerar(grupos);
    if (ws.conditionalFormattings) ws.conditionalFormattings.length = 0; // ExcelJS las reescribe mal
    if (data.colaborador) ws.getCell('B10').value = data.colaborador;
    if (data.motivo) ws.getCell('B11').value = data.motivo;
    if (data.ceco) ws.getCell('N10').value = data.ceco;

    // Una fila por gasto, ordenadas por fecha (la más vieja primero)
    var filas = data.tickets.slice().sort(function (a, b) { return (a.fecha || '').localeCompare(b.fecha || '') || (a.creado || '').localeCompare(b.creado || ''); });
    // Si hay más de 11 filas de gastos, se agregan filas antes de los totales
    // Agrupadas por día + concepto + moneda (en orden de fecha)
    var dias = [], idx = {};
    filas.forEach(function (t) {
      var g = grupoDe(t.grupo || 'OTROS'), mon = t.moneda || 'ARS', k = (t.fecha || '') + '|' + g.id + '|' + mon;
      if (!idx[k]) { idx[k] = { fecha: t.fecha, g: g, mon: mon, tickets: [], total: 0, totalArs: 0 }; dias.push(idx[k]); }
      idx[k].tickets.push(t); idx[k].total = round2(idx[k].total + round2(t.importe)); idx[k].totalArs = round2(idx[k].totalArs + ars(t));
    });
    var extra = Math.max(0, dias.length - 11), filaTot = 25 + extra, ultima = 24 + extra;
    if (extra) {
      var merges = (ws.model.merges || []).filter(function (r) { return Number(r.match(/\d+/)[0]) >= 25; });
      merges.forEach(function (r) { ws.unMergeCells(r); });
      ws.duplicateRow(24, extra, true);
      merges.forEach(function (r) { ws.mergeCells(r.replace(/\d+/g, function (n) { return Number(n) + extra; })); });
      'FGHIJLN'.split('').forEach(function (c) { var v = ws.getCell(c + filaTot).value; if (v && v.formula) ws.getCell(c + filaTot).value = { formula: 'SUM(' + c + '14:' + c + ultima + ')' }; });
      ws.getCell('L9').value = { formula: '+L' + filaTot }; ws.getCell('E8').value = { formula: '+K' + filaTot };
    }
    var cols = 'ABCDEFGHIJKLMNO'.split(''), total = 0, totalOrig = 0;
    for (var r = 14; r <= ultima; r++) {
      var d = dias[r - 14];
      cols.forEach(function (c) { ws.getCell(c + r).value = null; });
      if (!d) continue;
      var g = d.g, mon = d.mon, imp = d.total, tc = mon === 'ARS' ? 1 : (d.total ? Math.round(d.totalArs / d.total * 10000) / 10000 : 0);
      total += d.totalArs; totalOrig += imp;
      var fA = ws.getCell('A' + r);
      if (d.fecha) { fA.value = isoToDate(d.fecha); fA.style = Object.assign({}, fA.style, { numFmt: 'dd/mmm/yyyy' }); }
      ws.getCell('B' + r).value = g.concepto;
      ws.getCell('E' + r).value = monedaDe(mon).label;
      ws.getCell('F' + r).value = imp;
      ws.getCell('J' + r).value = { formula: 'F' + r + '+G' + r + '+H' + r + '+I' + r, result: imp };
      ws.getCell('K' + r).value = tc;
      ws.getCell('L' + r).value = { formula: 'J' + r + '*K' + r, result: round2(imp * tc) };
      var uniq = function (k) { var o = []; d.tickets.forEach(function (t) { var v = (t[k] || '').trim(); if (v && o.indexOf(v) < 0) o.push(v); }); return o.join(' / '); };
      ws.getCell('C' + r).value = uniq('cuit') || null;
      ws.getCell('D' + r).value = uniq('proveedor') || null;
      var n = d.tickets.length;
      ws.getCell('O' + r).value = descripcion(g) + ' (' + n + (n === 1 ? ' ticket' : ' tickets') + ')';
    }
    total = round2(total); totalOrig = round2(totalOrig);
    var setRes = function (addr, res) { var v = ws.getCell(addr).value; if (v && v.formula) ws.getCell(addr).value = { formula: v.formula, result: res }; };
    setRes('F' + filaTot, totalOrig); setRes('J' + filaTot, totalOrig);
    setRes('L' + filaTot, total); setRes('L9', total);

    var old = wb.getWorksheet('DETALLE TICKETS'); if (old) wb.removeWorksheet(old.id);
    var d = wb.addWorksheet('DETALLE TICKETS');
    d.columns = [
      { header: 'FECHA', key: 'f', width: 13 }, { header: 'CONCEPTO', key: 'c', width: 38 }, { header: 'RAZÓN SOCIAL', key: 'p', width: 30 }, { header: 'CUIT', key: 'u', width: 15 },
      { header: 'MONEDA', key: 'm', width: 16 }, { header: 'IMPORTE', key: 'i', width: 14 }, { header: 'TIPO DE CAMBIO', key: 'k', width: 14 },
      { header: 'IMPORTE EN ARS', key: 'a', width: 16 }, { header: 'N° EN WORD', key: 's', width: 12 }
    ];
    d.getRow(1).font = { name: 'Calibri Light', bold: true, color: { argb: 'FFFFFFFF' } };
    d.getRow(1).eachCell(function (c) { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E2A47' } }; });
    filas.forEach(function (t) {
      var mon = t.moneda || 'ARS';
      var row = d.addRow({ f: t.fecha ? isoToDate(t.fecha) : null, c: grupoDe(t.grupo || 'OTROS').concepto, p: t.proveedor || '', u: t.cuit || '', m: monedaDe(mon).label,
        i: round2(t.importe), k: mon === 'ARS' ? 1 : Number(t.tc) || 0, a: ars(t), s: t._n });
      row.font = { name: 'Calibri Light' };
    });
    var last = d.rowCount;
    var tr = d.addRow({ p: 'TOTAL EN ARS', a: { formula: 'SUM(H2:H' + last + ')', result: total } });
    tr.font = { name: 'Calibri Light', bold: true };
    d.getColumn('f').numFmt = 'dd/mm/yyyy'; d.getColumn('i').numFmt = '#,##0.00'; d.getColumn('a').numFmt = '#,##0.00'; d.getColumn('k').numFmt = '#,##0.0000';

    wb.calcProperties = wb.calcProperties || {};
    wb.calcProperties.fullCalcOnLoad = true;
    return await wb.xlsx.writeBuffer();
  }

  // images: ticketId -> {buf: Uint8Array, type: 'jpg'|'png', w, h}
  async function buildDocx(docx, data, images) {
    var grupos = agrupar(data.tickets);
    numerar(grupos);
    var D = docx, NB = { style: D.BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    var noBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };
    var MAXW = 290, MAXH = 400, children = [];
    var mes = data.mes ? data.mes.split('-') : null;
    children.push(new D.Paragraph({ children: [new D.TextRun({ text: 'Comprobantes de gastos' + (data.periodo ? ' – ' + data.periodo : mes ? ' – ' + MESES_LARGO[Number(mes[1]) - 1] + ' ' + mes[0] : ''), bold: true, size: 32, font: 'Calibri' })] }));
    var tot = round2(grupos.reduce(function (a, g) { return a + g.totalArs; }, 0));
    children.push(new D.Paragraph({ spacing: { after: 200 }, children: [new D.TextRun({ text: (data.colaborador || '') + (data.motivo ? ' · ' + data.motivo : '') + ' · Total ' + money(tot), size: 20, color: '595959', font: 'Calibri' })] }));
    grupos.forEach(function (gr, gi) {
      var n = gr.tickets.length, ext = gr.moneda !== 'ARS';
      children.push(new D.Paragraph({ pageBreakBefore: gi > 0, spacing: { before: gi > 0 ? 0 : 200, after: 60 },
        children: [new D.TextRun({ text: gr.grupo.label + (ext ? ' (' + gr.moneda + ')' : ''), bold: true, size: 36, font: 'Calibri' })] }));
      children.push(new D.Paragraph({ spacing: { after: 200 }, children: [new D.TextRun({ text: n + (n === 1 ? ' ticket' : ' tickets') + ' · total ' + money(gr.total, gr.moneda) + (ext ? ' = ' + money(gr.totalArs) : ''), size: 22, color: '595959', font: 'Calibri' })] }));
      var rows = [];
      for (var i = 0; i < n; i += 2) {
        var cells = [gr.tickets[i], gr.tickets[i + 1]].map(function (t) {
          var paras = [];
          if (t) {
            var img = images[t.id];
            if (img && img.w && img.h) {
              var sc = Math.min(MAXW / img.w, MAXH / img.h);
              paras.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.ImageRun({ type: img.type, data: img.buf, transformation: { width: Math.round(img.w * sc), height: Math.round(img.h * sc) } })] }));
            } else paras.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.TextRun({ text: 'Sin imagen', color: '999999' })] }));
            var cap = ['#' + t._n, fechaAR(t.fecha), t.proveedor, money(t.importe, gr.moneda)].filter(Boolean).join(' · ');
            paras.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing: { before: 60, after: 240 }, children: [new D.TextRun({ text: cap, size: 18, color: '404040', font: 'Calibri' })] }));
          } else paras.push(new D.Paragraph(''));
          return new D.TableCell({ children: paras, borders: noBorders, width: { size: 50, type: D.WidthType.PERCENTAGE }, verticalAlign: D.VerticalAlign.BOTTOM });
        });
        rows.push(new D.TableRow({ children: cells, cantSplit: true }));
      }
      children.push(new D.Table({ rows: rows, width: { size: 100, type: D.WidthType.PERCENTAGE }, borders: noBorders }));
    });
    if (!grupos.length) children.push(new D.Paragraph('Sin tickets'));
    var doc = new D.Document({ sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } }, children: children }] });
    return D.Packer.toBlob ? await D.Packer.toBlob(doc) : await D.Packer.toBuffer(doc);
  }

  var api = { GRUPOS: GRUPOS, PRINCIPALES: PRINCIPALES, CONCEPTOS: CONCEPTOS, MONEDAS: MONEDAS, MESES_LARGO: MESES_LARGO,
    grupoDe: grupoDe, monedaDe: monedaDe, agrupar: agrupar, buildXlsx: buildXlsx, buildDocx: buildDocx,
    money: money, fmtNum: fmtNum, ars: ars, fechaAR: fechaAR, round2: round2, nombreArchivo: nombreArchivo };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Builders = api;
})(this);
