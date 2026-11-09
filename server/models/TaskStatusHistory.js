const mongoose = require('mongoose');

const taskStatusHistorySchema = new mongoose.Schema({
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
    board: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true },
    fromStatus: { type: String, enum: ['todo', 'in-progress', 'done'] },
    toStatus: { type: String, enum: ['todo', 'in-progress', 'done'], required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now }
}, { timestamps: true });

taskStatusHistorySchema.index({ board: 1, changedAt: 1 });
taskStatusHistorySchema.index({ task: 1, changedAt: 1 });

module.exports = mongoose.model('TaskStatusHistory', taskStatusHistorySchema);
