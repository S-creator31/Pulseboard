const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const { startDeliveryAlertScheduler } = require('./services/deliveryAlerts');

const activityLogRoutes = require('./routes/activityLogRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const sprintRoutes = require('./routes/sprintRoutes');
const timeEntryRoutes = require('./routes/timeEntryRoutes');
const dependencyRoutes = require('./routes/dependencyRoutes');
const aiRoutes = require('./routes/aiRoutes');
const riskRoutes = require('./routes/riskRoutes');

dotenv.config({ path: path.join(__dirname, '.env') });
connectDB();
if (mongoose.connection.readyState === 1) startDeliveryAlertScheduler();
else mongoose.connection.once('connected', startDeliveryAlertScheduler);

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3100',
  process.env.CLIENT_ORIGIN,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

const io = new Server(server, {
  pingInterval: 25000,
  pingTimeout: 60000,
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
  }
});
app.set('io', io);
require('./realtime/boardSync')(io);

app.use(express.json());

app.get('/', (req, res) => {
    res.send('Welcome to the Backend of PulseBoard');
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/boards', require('./routes/boardRoutes'));
app.use('/api/lists', require('./routes/listRoutes'));
app.use('/api/tasks', require('./routes/taskRoutes'));
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/sprints', sprintRoutes);
app.use('/api/dependencies', dependencyRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api', analyticsRoutes);
app.use('/api', timeEntryRoutes);
app.use('/api', riskRoutes);
app.use('/api', require('./routes/alertRoutes'));
app.use('/api', require('./routes/reportRoutes'));

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`PulseBoard Server running on port ${PORT}`);
});

module.exports = app;
