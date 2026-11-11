const Sprint = require('../models/Sprint');
const ActivityLog = require('../models/ActivityLog');
const { getBurndown, getVelocity } = require('./analytics');

function csvCell(value) {
  let text = value == null ? '' : String(value);
  if (/^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

async function buildReport(boardId, sprintId) {
  const sprint = await Sprint.findOne({ _id: sprintId, board: boardId });
  if (!sprint) throw new Error('Sprint not found on this board');
  const [burndown, velocity, logs] = await Promise.all([
    getBurndown(sprint._id), getVelocity(boardId),
    ActivityLog.find({ board: boardId }).populate('user', 'name').populate('task', 'title').sort({ createdAt: -1 }).limit(500).lean()
  ]);
  return { sprint, burndown: burndown.days || [], velocity: velocity.sprints || [], logs };
}

function makeCsv(report) {
  const rows = [['PulseBoard Delivery Report', report.sprint.name], [], ['Sprint Burndown'], ['Date', 'Ideal Remaining Points', 'Actual Remaining Points', 'Scope Added Points'],
    ...report.burndown.map(day => [day.date, day.ideal, day.remaining, day.scopeAdded]), [], ['Velocity'], ['Sprint', 'Committed Points', 'Completed Points', 'Status'],
    ...report.velocity.map(item => [item.name, item.committed, item.completed, item.status]), [], ['Audit Log'], ['Timestamp', 'Actor', 'Action', 'Task'],
    ...report.logs.map(log => [new Date(log.createdAt).toISOString(), log.user?.name || 'System', log.action, log.task?.title || ''])];
  return `\uFEFF${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}`;
}

function pdfEscape(text) {
  return String(text ?? '').replace(/[^\x20-\x7E]/g, '?').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapPdfLine(value, maxLength = 100) {
  const text = String(value ?? '');
  const wrapped = [];
  for (let offset = 0; offset < text.length; offset += maxLength) wrapped.push(text.slice(offset, offset + maxLength));
  return wrapped.length ? wrapped : [''];
}

function makePdf(report) {
  const lines = [
    'PULSEBOARD DELIVERY REPORT', `Sprint: ${report.sprint.name}`,
    `Window: ${new Date(report.sprint.startsOn).toLocaleDateString('en-US')} - ${new Date(report.sprint.endsOn).toLocaleDateString('en-US')}`,
    '', 'SPRINT BURNDOWN', 'Date       Ideal    Remaining    Scope Added',
    ...report.burndown.map(d => `${d.date}   ${d.ideal}       ${d.remaining}           ${d.scopeAdded}`),
    '', 'VELOCITY', 'Sprint                         Committed   Completed   Status',
    ...report.velocity.map(v => `${v.name}   ${v.committed}            ${v.completed}           ${v.status}`),
    '', 'AUDIT LOG (latest 500 entries)',
    ...report.logs.map(log => `${new Date(log.createdAt).toISOString()} | ${log.user?.name || 'System'} | ${log.action}${log.task?.title ? ` [${log.task.title}]` : ''}`)
  ];
  const printableLines = lines.flatMap(line => wrapPdfLine(line));
  const pages = [];
  for (let i = 0; i < printableLines.length; i += 48) pages.push(printableLines.slice(i, i + 48));
  const objects = [null, '<< /Type /Catalog /Pages 2 0 R >>', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const pageRefs = [];
  pages.forEach((pageLines, index) => {
    const pageObj = 4 + index * 2;
    const streamObj = pageObj + 1;
    pageRefs.push(`${pageObj} 0 R`);
    const commands = ['BT', '/F1 8 Tf', '40 755 Td', '11 TL', ...pageLines.flatMap((line, lineIndex) => [lineIndex ? 'T*' : '', `(${pdfEscape(line)}) Tj`]).filter(Boolean), 'ET'].join('\n');
    const stream = `<< /Length ${Buffer.byteLength(commands, 'ascii')} >>\nstream\n${commands}\nendstream`;
    objects[pageObj] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamObj} 0 R >>`;
    objects[streamObj] = stream;
  });
  objects[2] = `<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${pages.length} >>`;
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 1; i < objects.length; i++) { offsets[i] = Buffer.byteLength(pdf, 'binary'); pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`; }
  const xref = Buffer.byteLength(pdf, 'binary');
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objects.length; i++) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'binary');
}

module.exports = { buildReport, makeCsv, makePdf };
