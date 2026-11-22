const express = require('express');
require('dotenv').config();
const { isPostgres, ready } = require('./db');
const authRoutes = require('./routes/auth');
const pollRoutes = require('./routes/polls');
const adminRoutes = require('./routes/admin');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 4000;
app.use(cors({ origin: process.env.WEB_ORIGIN || true }));
app.use(express.json({ limit: '32kb' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/polls', pollRoutes);
app.use('/api/admin', adminRoutes);
async function start() {
  try {
    await ready;
    if (isPostgres) {
      console.log('Applying Postgres schema...');
      require('./migrate');
    }
    app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
  } catch (error) {
    console.error('Unable to initialize the database:', error);
    process.exit(1);
  }
}
start();
