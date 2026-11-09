const mongoose = require('mongoose');

const sprintSchema = new mongoose.Schema({
    board: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true },
    name: { type: String, required: true, trim: true },
    goal: { type: String, default: '' },
    startsOn: { type: Date, required: true },
    endsOn: { type: Date, required: true },
    status: { type: String, enum: ['planned', 'active', 'closed'], default: 'planned' },
    committedPoints: { type: Number, default: 0 }
}, { timestamps: true });

sprintSchema.index({ board: 1, startsOn: -1 });

module.exports = mongoose.model('Sprint', sprintSchema);
