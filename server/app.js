const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

const activityLogRoutes = require('./routes/activityLogRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const sprintRoutes = require('./routes/sprintRoutes');
const timeEntryRoutes = require('./routes/timeEntryRoutes');
const dependencyRoutes = require('./routes/dependencyRoutes');
const aiRoutes = require('./routes/aiRoutes');
const riskRoutes = require('./routes/riskRoutes');

dotenv.config();
connectDB();

const app = express();

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

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`PulseBoard Server running on port ${PORT}`);
});

module.exports = app;
