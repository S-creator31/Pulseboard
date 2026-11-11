const mongoose = require('mongoose');

const boardSchema = new mongoose.Schema({
    title: {type: String, required: true},
    // Accent color for this board, chosen at creation time. Drives the
    // board card on the dashboard and the header on the board page —
    // added to support Pulseboard's per-board color identity in the UI.
    color: {
        type: String,
        enum: ['violet', 'coral', 'teal', 'amber', 'pink'],
        default: 'violet'
    },
    owner: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    members: [{
        user: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
        role: {type: String, enum: ['admin', 'member', 'viewer'], default: 'member'}
    }],
    alertSettings: {
        wipLimit: { type: Number, default: 6, min: 1, max: 100 },
        webhookUrl: { type: String, default: '' },
        slackWebhookUrl: { type: String, default: '' }
    },
    createdAt: { type: Date, default: Date.now}
});

module.exports = mongoose.model('Board', boardSchema);
