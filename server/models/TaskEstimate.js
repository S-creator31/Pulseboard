const mongoose = require('mongoose');

/**
 * Three-point (PERT) duration estimate for a task, in days.
 * Kept in its own collection so the Task schema and the existing CPM inputs are untouched.
 * A task without a TaskEstimate keeps its ordinary durationDays.
 */
const taskEstimateSchema = new mongoose.Schema({
    board: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true },
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true, unique: true },
    optimistic: { type: Number, required: true, min: 0 },
    mostLikely: { type: Number, required: true, min: 0 },
    pessimistic: { type: Number, required: true, min: 0 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

taskEstimateSchema.index({ board: 1 });

module.exports = mongoose.model('TaskEstimate', taskEstimateSchema);
