const Board = require('../models/Board');
const Sprint = require('../models/Sprint');
const { buildReport, makeCsv, makePdf } = require('../services/reportExport');

exports.downloadDeliveryReport = async (req, res) => {
  try {
    const board = await Board.findById(req.params.boardId).select('title owner members');
    if (!board) return res.status(404).json({ message: 'Board not found' });
    const userId = String(req.user._id);
    const isMember = String(board.owner) === userId || board.members.some(member => String(member.user) === userId);
    if (!isMember) return res.status(403).json({ message: 'Not authorized for this board' });
    const { sprintId, format } = req.params;
    const sprintExists = await Sprint.exists({ _id: sprintId, board: board._id });
    if (!sprintExists) return res.status(404).json({ message: 'Sprint not found on this board' });
    const report = await buildReport(board._id, sprintId);
    const safePart = value => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const filename = `pulseboard-${safePart(board.title)}-${safePart(report.sprint.name)}`;
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return res.send(makeCsv(report));
    }
    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      return res.send(makePdf(report));
    }
    return res.status(400).json({ message: 'format must be csv or pdf' });
  } catch (err) {
    const status = err.message === 'Sprint not found on this board' ? 404 : 500;
    console.error('Delivery report generation failed:', err.message);
    return res.status(status).json({ message: status === 404 ? err.message : 'Could not generate delivery report' });
  }
};
