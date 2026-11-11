const Board = require('../models/Board');
const { validateDestination, queueBoardAlertEvaluation } = require('../services/deliveryAlerts');

exports.getAlertSettings = async (req, res) => {
  const board = await Board.findById(req.params.boardId).select('alertSettings');
  if (!board) return res.status(404).json({ message: 'Board not found' });
  const settings = board.alertSettings || {};
  res.json({ wipLimit: settings.wipLimit || 6, webhookConfigured: Boolean(settings.webhookUrl), slackConfigured: Boolean(settings.slackWebhookUrl) });
};

exports.updateAlertSettings = async (req, res) => {
  try {
    const board = await Board.findById(req.params.boardId);
    if (!board) return res.status(404).json({ message: 'Board not found' });
    const { wipLimit, webhookUrl, slackWebhookUrl } = req.body || {};
    if (wipLimit !== undefined && (!Number.isInteger(Number(wipLimit)) || Number(wipLimit) < 1 || Number(wipLimit) > 100)) {
      return res.status(400).json({ message: 'wipLimit must be an integer from 1 to 100' });
    }
    const current = board.alertSettings || {};
    if (webhookUrl !== undefined) current.webhookUrl = await validateDestination(String(webhookUrl).trim(), false);
    if (slackWebhookUrl !== undefined) current.slackWebhookUrl = await validateDestination(String(slackWebhookUrl).trim(), true);
    if (wipLimit !== undefined) current.wipLimit = Number(wipLimit);
    board.alertSettings = current;
    await board.save();
    queueBoardAlertEvaluation(board._id);
    res.json({ wipLimit: current.wipLimit || 6, webhookConfigured: Boolean(current.webhookUrl), slackConfigured: Boolean(current.slackWebhookUrl) });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Could not update alert settings' });
  }
};
