const dns = require('node:dns').promises;
const net = require('node:net');
const Board = require('../models/Board');
const Task = require('../models/Task');
const Sprint = require('../models/Sprint');
const TaskDependency = require('../models/TaskDependency');
const AlertState = require('../models/AlertState');
const { computeSchedule } = require('./schedule');
const criticalTimers = new Map();

function isPublicAddress(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168));
  }
  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    return normalized === '::1' ? false : !(normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:'));
  }
  return false;
}

async function validateDestination(value, slack = false) {
  if (!value) return '';
  let url;
  try { url = new URL(value); } catch { throw new Error('Webhook URL is invalid'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    throw new Error('Webhook URLs must use HTTPS and cannot include credentials or a custom port');
  }
  if (slack && url.hostname !== 'hooks.slack.com') {
    throw new Error('Slack webhook must use hooks.slack.com');
  }
  if (!slack) {
    if (url.hostname === 'localhost' || url.hostname.endsWith('.local')) throw new Error('Webhook host must be publicly reachable');
    const addresses = net.isIP(url.hostname) ? [{ address: url.hostname }] : await dns.lookup(url.hostname, { all: true });
    if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
      throw new Error('Webhook host must resolve only to public IP addresses');
    }
  }
  return url.toString();
}

async function sendAlert(board, condition, message, details) {
  if (!board.alertSettings?.webhookUrl && !board.alertSettings?.slackWebhookUrl) return;
  const state = await AlertState.findOne({ board: board._id, condition });
  let claimed;
  if (state) {
    if (state.active) return;
    claimed = await AlertState.findOneAndUpdate(
      { _id: state._id, active: false },
      { $set: { active: true, lastTriggeredAt: new Date() } }, { new: true }
    );
  } else {
    try {
      claimed = await AlertState.create({ board: board._id, condition, active: true, lastTriggeredAt: new Date() });
    } catch (err) {
      if (err.code === 11000) return;
      throw err;
    }
  }
  if (!claimed) return;

  const payload = { event: 'pulseboard.delivery_alert', board: { id: String(board._id), title: board.title }, condition, message, details, occurredAt: new Date().toISOString() };
  const destinations = [
    [board.alertSettings?.webhookUrl, false],
    [board.alertSettings?.slackWebhookUrl, true]
  ].filter(([url]) => Boolean(url));
  const deliveries = await Promise.allSettled(destinations.map(async ([destination, slack]) => {
    const body = slack ? { text: `*${board.title}: ${message}*` } : payload;
    const response = await fetch(destination, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000), redirect: 'error'
    });
    if (!response.ok) throw new Error(`Webhook returned HTTP ${response.status}`);
  }));
  if (deliveries.every(result => result.status === 'rejected')) {
    await AlertState.updateOne({ _id: claimed._id }, { $set: { active: false } });
    console.error(`All delivery alert endpoints failed for board ${board._id}, condition ${condition}`);
  }
}

async function clearAlert(boardId, condition) {
  await AlertState.updateOne({ board: boardId, condition }, { $set: { active: false } });
}

function scheduleNextCriticalCheck(boardId, schedule) {
  const key = String(boardId);
  if (criticalTimers.has(key)) clearTimeout(criticalTimers.get(key));
  const now = Date.now();
  const nextFinish = schedule.tasks
    .filter(item => item.isCritical && item.raw?.status !== 'done' && item.raw?.startDate)
    .map(item => new Date(item.raw.startDate).getTime() + Math.max(1, Number(item.raw.durationDays) || 1) * 86400000)
    .filter(finish => finish > now)
    .sort((a, b) => a - b)[0];
  if (!nextFinish) return;
  const timer = setTimeout(() => evaluateBoardAlerts(boardId), Math.min(nextFinish - now + 50, 2147483000));
  timer.unref?.();
  criticalTimers.set(key, timer);
}

async function evaluateBoardAlerts(boardId) {
  try {
    const board = await Board.findById(boardId).select('title alertSettings');
    if (!board) return;
    const [tasks, sprint, dependencies] = await Promise.all([
      Task.find({ board: boardId }),
      Sprint.findOne({ board: boardId, status: 'active' }).sort({ startsOn: -1 }),
      TaskDependency.find({ board: boardId })
    ]);
    const settings = board.alertSettings || {};
    const wipLimit = Math.max(1, Number(settings.wipLimit) || 6);
    const wipCount = tasks.filter(task => task.status === 'in-progress').length;
    if (wipCount > wipLimit) await sendAlert(board, 'wip', `WIP cap breached (${wipCount}/${wipLimit})`, { current: wipCount, limit: wipLimit });
    else await clearAlert(boardId, 'wip');

    if (sprint) {
      const sprintTasks = tasks.filter(task => String(task.sprint || '') === String(sprint._id));
      const currentPoints = sprintTasks.reduce((sum, task) => sum + (Number(task.storyPoints) || 0), 0);
      const committed = Number(sprint.committedPoints) || 0;
      const increasePercent = committed > 0 ? ((currentPoints - committed) / committed) * 100 : (currentPoints > 0 ? 100 : 0);
      if (increasePercent > 15) await sendAlert(board, 'scope', `Sprint scope increased ${Math.round(increasePercent)}% (${currentPoints} points vs ${committed} committed)`, { currentPoints, committedPoints: committed, increasePercent: Math.round(increasePercent) });
      else await clearAlert(boardId, 'scope');
    } else await clearAlert(boardId, 'scope');

    const schedule = computeSchedule(tasks, dependencies);
    const now = Date.now();
    const slipped = schedule.tasks.filter(item => item.isCritical && item.raw?.status !== 'done' && item.raw?.startDate &&
      new Date(item.raw.startDate).getTime() + Math.max(1, Number(item.raw.durationDays) || 1) * 86400000 < now);
    if (slipped.length) {
      await sendAlert(board, 'critical-path', `${slipped.length} critical path task(s) are past their planned finish`, {
        tasks: slipped.map(task => ({ id: task.id, title: task.title, plannedFinish: new Date(new Date(task.raw.startDate).getTime() + Math.max(1, Number(task.raw.durationDays) || 1) * 86400000).toISOString() }))
      });
    } else await clearAlert(boardId, 'critical-path');
    scheduleNextCriticalCheck(boardId, schedule);
  } catch (err) {
    console.error('Delivery alert evaluation failed:', err.message);
  }
}

function queueBoardAlertEvaluation(boardId) {
  if (boardId) setImmediate(() => evaluateBoardAlerts(boardId));
}

async function startDeliveryAlertScheduler() {
  try {
    const boards = await Board.find({}).distinct('_id');
    boards.forEach(queueBoardAlertEvaluation);
  } catch (err) {
    console.error('Could not initialize delivery alert schedules:', err.message);
  }
}

module.exports = { validateDestination, queueBoardAlertEvaluation, startDeliveryAlertScheduler };
