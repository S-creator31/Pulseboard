const mongoose = require('mongoose');

const alertStateSchema = new mongoose.Schema({
    board: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true },
    condition: { type: String, enum: ['wip', 'scope', 'critical-path'], required: true },
    active: { type: Boolean, default: false },
    lastTriggeredAt: { type: Date }
}, { timestamps: true });

alertStateSchema.index({ board:  1, condition: 1 }, { unique: true });

module.exports = mongoose.model('AlertState', alertStateSchema);
