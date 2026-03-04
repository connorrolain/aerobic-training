const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const PASSWORD = process.env.APP_PASSWORD || 'changeme';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS data (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '[]'
    )
  `);
}

app.use(express.json({ limit: '10mb' }));

// Password protection
app.use((req, res, next) => {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Basic ')) {
    const decoded = Buffer.from(auth.slice(6), 'base64').toString();
    const pass = decoded.split(':').slice(1).join(':');
    if (pass === PASSWORD) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Trail Training"');
  res.status(401).send('Authentication required');
});

app.use(express.static(path.join(__dirname, 'public')));

// Get data by key
app.get('/api/data/:key', async (req, res) => {
  try {
    const result = await pool.query('SELECT value FROM data WHERE key = $1', [req.params.key]);
    res.json(result.rows[0]?.value || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save data by key
app.put('/api/data/:key', async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO data (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $2`,
      [req.params.key, JSON.stringify(req.body)]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

initDb().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch(err => {
  console.error('Database init failed:', err);
  process.exit(1);
});
