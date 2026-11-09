const mongoose = require('mongoose');

const listSchema = new mongoose.Schema({
    title: { type: String, required: true },
    board: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true },
    order: { type: Number, default: 0 },
    statusKey: {
        type: String,
        enum: ['todo', 'in-progress', 'done'],
        default: function () {
            const lower = (this.title || '').toLowerCase();
            if (lower.includes('done') || lower.includes('complete') || lower.includes('closed') || lower.includes('finish')) return 'done';
            if (lower.includes('prog') || lower.includes('doing') || lower.includes('review') || lower.includes('active') || lower.includes('dev')) return 'in-progress';
            return 'todo';
        }
    }
}, { timestamps: true });

listSchema.virtual('tasks', {
    ref: 'Task',
    localField: '_id',
    foreignField: 'list',
    justOne: false,
});

listSchema.set('toObject', { virtuals: true });
listSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('List', listSchema);
