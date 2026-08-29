const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

const activityLogRoutes = require('./routes/activityLogRoutes')

dotenv.config();
connectDB();

const app = express();


// Allow local dev (any port on localhost/127.0.0.1) plus whatever the
// deployed frontend origin is set to via env. The old hardcoded single
// origin blocked local integration testing entirely.
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
    res.send('Welcome to the Backend of Trello-lite-App');
}) 

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/boards', require('./routes/boardRoutes'));
app.use('/api/lists', require('./routes/listRoutes'));
app.use('/api/tasks', require('./routes/taskRoutes'))
app.use('/api/activity-logs', activityLogRoutes)

const PORT  = 5000;

app.listen(PORT, () => {
    console.log(`Server running on ${PORT}`); 
});