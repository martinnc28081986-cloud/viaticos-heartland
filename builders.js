(function (root) {
  var GRUPOS = [
    { id: 'PEAJES', label: 'Peajes', concepto: '53320 - PEAJES Y ESTACIONAMIENTO' },
    { id: 'ESTACIONAMIENTO', label: 'Estacionamiento', concepto: '53320 - PEAJES Y ESTACIONAMIENTO' },
    { id: 'COMBUSTIBLE', label: 'Combustible', concepto: '53330 - GASOLINA' },
    { id: 'COMIDAS', label: 'Comidas', concepto: '53350 - COMIDAS Y ENTRETENIMIENTO' },
    { id: 'REPARACION DE AUTO', label: 'Reparación de auto', concepto: '60300 - OTROS GASTOS DE VENTAS' },
    { id: 'TAXIS Y PASAJES', label: 'Taxis y pasajes', concepto: '53310 - TAXIS Y PASAJES' },
    { id: 'HOSPEDAJE', label: 'Hospedaje', concepto: '53340 - HOSPEDAJE' },
    { id: 'OTROS', label: 'Otros', concepto: '53500 - GASTOS MISCELANEOS' }
  ];
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var MESES_LARGO = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  function grupoDe(id) { for (var i = 0; i < GRUPOS.length; i++) if (GRUPOS[i].id === id) return GRUPOS[i]; return GRUPOS[GRUPOS.length - 1]; }
  function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function money(n) { return '$ ' + (Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function fechaAR(iso) { if (!iso) return ''; var p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function isoToDate(iso) { var p = iso.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])); }
  function nombreArchivo(mes, ext) { var p = mes.split('-'); return 'Gastos_Martin_Castillo_' + MESES[Number(p[1]) - 1] + p[0].slice(2) + '.' + ext; }

  // Agrupa tickets en el orden de GRUPOS, ordenados por fecha
  function agrupar(tickets) {
    var out = [];
    GRUPOS.forEach(function (g) {
      var ts = tickets.filter(function (t) { return (t.grupo || 'OTROS') === g.id; })
        .sort(function (a, b) { return (a.fecha || '').localeCompare(b.fecha || ''); });
      if (!ts.length) return;
      var total = round2(ts.reduce(function (s, t) { return s + (Number(t.importe) || 0); }, 0));
      var fechas = ts.map(function (t) { return t.fecha; }).filter(Boolean).sort();
      out.push({ grupo: g, tickets: ts, total: total, ultimaFecha: fechas[fechas.length - 1] || null });
    });
    return out;
  }

  // Número de cada ticket en el Word (orden de grupos y fecha)
  function numerar(grupos) { var n = 0; grupos.forEach(function (g) { g.tickets.forEach(function (t) { t._n = ++n; }); }); return n; }

  async function buildXlsx(ExcelJS, templateBuf, data) {
    var wb = new ExcelJS.Workbook();
    await wb.xlsx.load(templateBuf);
    var ws = wb.getWorksheet('REPORTE DE GASTOS');
    var grupos = agrupar(data.tickets);
    numerar(grupos);
    // ExcelJS reescribe estas reglas (resaltan celdas vacías del encabezado) en un formato que Excel rechaza
    if (ws.conditionalFormattings) ws.conditionalFormattings.length = 0;
    if (data.colaborador) ws.getCell('B10').value = data.colaborador;
    if (data.motivo) ws.getCell('B11').value = data.motivo;
    if (data.ceco) ws.getCell('N10').value = data.ceco;
    var cols = 'ABCDEFGHIJKLMNO'.split('');
    var total = 0;
    for (var r = 14; r <= 24; r++) {
      var gr = grupos[r - 14];
      cols.forEach(function (c) { ws.getCell(c + r).value = null; });
      if (!gr) continue;
      total += gr.total;
      // Un solo ticket: su fecha. Varios tickets juntos: solo el mes (ej. oct/2026)
      if (gr.tickets.length === 1 && gr.ultimaFecha) {
        ws.getCell('A' + r).value = isoToDate(gr.ultimaFecha);
        ws.getCell('A' + r).numFmt = 'dd/mmm/yyyy';
      } else {
        var mesRef = data.mes || (gr.ultimaFecha ? gr.ultimaFecha.slice(0, 7) : null);
        if (mesRef) { ws.getCell('A' + r).value = isoToDate(mesRef + '-01'); ws.getCell('A' + r).numFmt = 'mmm/yyyy'; }
      }
      ws.getCell('B' + r).value = gr.grupo.concepto;
      ws.getCell('E' + r).value = 'ARS - Argentina';
      ws.getCell('F' + r).value = gr.total;
      ws.getCell('J' + r).value = { formula: 'F' + r + '+G' + r + '+H' + r + '+I' + r, result: gr.total };
      ws.getCell('K' + r).value = 1;
      ws.getCell('L' + r).value = { formula: 'J' + r + '*K' + r, result: gr.total };
      var n = gr.tickets.length;
      ws.getCell('O' + r).value = gr.grupo.id + ' (' + n + (n === 1 ? ' ticket)' : ' tickets)');
    }
    total = round2(total);
    var setRes = function (addr, res) { var v = ws.getCell(addr).value; if (v && v.formula) ws.getCell(addr).value = { formula: v.formula, result: res }; };
    setRes('F25', total); setRes('J25', total); setRes('L25', total);
    setRes('G25', 0); setRes('H25', 0); setRes('I25', 0); setRes('N25', 0);
    setRes('L9', total); setRes('E8', 0);

    // Hoja de detalle
    var old = wb.getWorksheet('DETALLE TICKETS'); if (old) wb.removeWorksheet(old.id);
    var d = wb.addWorksheet('DETALLE TICKETS');
    d.columns = [
      { header: 'FECHA', key: 'f', width: 13 }, { header: 'GRUPO', key: 'g', width: 22 },
      { header: 'CONCEPTO', key: 'c', width: 38 }, { header: 'PROVEEDOR / LUGAR', key: 'p', width: 32 },
      { header: 'IMPORTE (ARS)', key: 'i', width: 16 }, { header: 'N° EN WORD', key: 's', width: 12 }
    ];
    d.getRow(1).font = { name: 'Calibri Light', bold: true, color: { argb: 'FFFFFFFF' } };
    d.getRow(1).eachCell(function (c) { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } }; });
    grupos.forEach(function (gr) {
      gr.tickets.forEach(function (t) {
        var row = d.addRow({ f: t.fecha ? isoToDate(t.fecha) : null, g: gr.grupo.id, c: gr.grupo.concepto, p: t.proveedor || '', i: round2(t.importe), s: t._n });
        row.font = { name: 'Calibri Light' };
      });
    });
    var last = d.rowCount;
    var tr = d.addRow({ p: 'TOTAL', i: { formula: 'SUM(E2:E' + last + ')', result: total } });
    tr.font = { name: 'Calibri Light', bold: true };
    d.getColumn('f').numFmt = 'dd/mm/yyyy';
    d.getColumn('i').numFmt = '#,##0.00';

    wb.calcProperties = wb.calcProperties || {};
    wb.calcProperties.fullCalcOnLoad = true;
    return await wb.xlsx.writeBuffer();
  }

  // images: map ticketId -> {buf: Uint8Array, type: 'jpg'|'png', w, h}
  async function buildDocx(docx, data, images) {
    var grupos = agrupar(data.tickets);
    numerar(grupos);
    var D = docx, NB = { style: D.BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    var noBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };
    var MAXW = 290, MAXH = 400; // px
    var children = [];
    var mes = data.mes ? data.mes.split('-') : null;
    children.push(new D.Paragraph({ children: [new D.TextRun({ text: 'Comprobantes de gastos' + (mes ? ' – ' + MESES_LARGO[Number(mes[1]) - 1] + ' ' + mes[0] : ''), bold: true, size: 32, font: 'Calibri' })] }));
    var tot = round2(grupos.reduce(function (a, g) { return a + g.total; }, 0));
    children.push(new D.Paragraph({ spacing: { after: 200 }, children: [new D.TextRun({ text: (data.colaborador || '') + (data.motivo ? ' · ' + data.motivo : '') + ' · Total ' + money(tot), size: 20, color: '595959', font: 'Calibri' })] }));
    grupos.forEach(function (gr, gi) {
      var n = gr.tickets.length;
      children.push(new D.Paragraph({ pageBreakBefore: gi > 0, spacing: { before: gi > 0 ? 0 : 200, after: 60 },
        children: [new D.TextRun({ text: gr.grupo.label, bold: true, size: 36, font: 'Calibri' })] }));
      children.push(new D.Paragraph({ spacing: { after: 200 }, children: [new D.TextRun({ text: n + (n === 1 ? ' ticket' : ' tickets') + ' · total ' + money(gr.total), size: 22, color: '595959', font: 'Calibri' })] }));
      var rows = [];
      for (var i = 0; i < n; i += 2) {
        var cells = [gr.tickets[i], gr.tickets[i + 1]].map(function (t) {
          var paras = [];
          if (t) {
            var img = images[t.id];
            if (img && img.w && img.h) {
              var sc = Math.min(MAXW / img.w, MAXH / img.h);
              paras.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.ImageRun({ type: img.type, data: img.buf, transformation: { width: Math.round(img.w * sc), height: Math.round(img.h * sc) } })] }));
            } else {
              paras.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.TextRun({ text: 'Sin imagen', color: '999999' })] }));
            }
            var cap = ['#' + t._n, fechaAR(t.fecha), t.proveedor, money(t.importe)].filter(Boolean).join(' · ');
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

  var api = { GRUPOS: GRUPOS, MESES_LARGO: MESES_LARGO, grupoDe: grupoDe, agrupar: agrupar,
    buildXlsx: buildXlsx, buildDocx: buildDocx, money: money, fechaAR: fechaAR, round2: round2, nombreArchivo: nombreArchivo };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Builders = api;
})(this);
