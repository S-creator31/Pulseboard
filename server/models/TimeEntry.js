const mongoose = require('mongoose');

const timeEntrySchema = new mongoose.Schema({
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    minutes: { type: Number, required: true },
    loggedOn: { type: Date, default: Date.now },
    note: { type: String, default: '' }
}, { timestamps: true });

timeEntrySchema.index({ user: 1, loggedOn: 1 });

module.exports = mongoose.model('TimeEntry', timeEntrySchema);
