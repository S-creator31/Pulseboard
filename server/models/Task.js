const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    board: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true },
    list: { type: mongoose.Schema.Types.ObjectId, ref: 'List', required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['todo', 'in-progress', 'done'], default: 'todo' },
    order: { type: Number, default: 0 },
    storyPoints: { type: Number, default: 0 },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    estimateHours: { type: Number, default: 0 },
    startDate: { type: Date },
    durationDays: { type: Number, default: 1 },
    sprint: { type: mongoose.Schema.Types.ObjectId, ref: 'Sprint' }
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);
