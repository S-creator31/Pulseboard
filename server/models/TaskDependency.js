const mongoose = require('mongoose');

const taskDependencySchema = new mongoose.Schema({
    board: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true },
    predecessor: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
    successor: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true }
}, { timestamps: true });

taskDependencySchema.index({ predecessor: 1, successor: 1 }, { unique: true });
taskDependencySchema.index({ board: 1 });

module.exports = mongoose.model('TaskDependency', taskDependencySchema);
