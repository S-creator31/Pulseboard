const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
    board: {
        type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId, ref: 'User'
    },
    action: {
        type: String, required: true
    },
    task: {
        type: mongoose.Schema.Types.ObjectId, ref: 'Task'
    },
    fromStatus: {
        type: String, enum: ['todo', 'in-progress', 'done']
    },
    toStatus: {
        type: String, enum: ['todo', 'in-progress', 'done']
    }
}, { timestamps: true });

activityLogSchema.index({ board: 1, createdAt: -1, _id: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
