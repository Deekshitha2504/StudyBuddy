const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

// Set up PostgreSQL Pool connection (configured for cloud databases like Neon)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Required for Neon/Render PG connections
    }
});

app.use(bodyParser.json());
app.use(express.static(__dirname)); // Serves static files
app.use(cors());

// Initialize SQL Tables for PostgreSQL
const initQueries = `
    CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY, 
        task TEXT
    );
    CREATE TABLE IF NOT EXISTS task_history (
        id SERIAL PRIMARY KEY,
        task_name TEXT,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS timer_state (
        id INTEGER PRIMARY KEY, 
        time_left INTEGER
    );
    CREATE TABLE IF NOT EXISTS stats (
        id INTEGER PRIMARY KEY, 
        level INTEGER, 
        xp INTEGER
    );
    INSERT INTO stats (id, level, xp) VALUES (1, 1, 0) ON CONFLICT (id) DO NOTHING;
`;

pool.query(initQueries)
    .then(() => console.log("Database initialized successfully."))
    .catch(err => console.error("Database initialization error:", err.message));

// --- API ROUTES ---

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'sb1.html'));
});

// Get all tasks
app.get('/tasks', (req, res) => {
    pool.query("SELECT * FROM tasks ORDER BY id ASC", (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(result.rows);
    });
});

// Add a task
app.post('/tasks', (req, res) => {
    const { task } = req.body;
    pool.query("INSERT INTO tasks (task) VALUES ($1) RETURNING id", [task], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: result.rows[0].id, task });
    });
});

// Delete a task (with archive logic)
app.delete('/tasks/:id', (req, res) => {
    const taskId = req.params.id;

    // 1. Find the task name
    pool.query("SELECT task FROM tasks WHERE id = $1", [taskId], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        const row = result.rows[0];
        if (row) {
            // 2. Save to history
            pool.query("INSERT INTO task_history (task_name) VALUES ($1)", [row.task], (err) => {
                if (err) console.error("History logging error:", err.message);

                // 3. Delete task
                pool.query("DELETE FROM tasks WHERE id = $1", [taskId], (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ message: "Task archived for Data Science!" });
                });
            });
        } else {
            res.status(404).json({ error: "Task not found" });
        }
    });
});

// Route to get current stats
app.get('/stats', (req, res) => {
    pool.query("SELECT level, xp FROM stats WHERE id = 1", (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(result.rows[0] || { level: 1, xp: 0 });
    });
});

// Route to handle XP gain
app.post('/complete-task', (req, res) => {
    pool.query("SELECT level, xp FROM stats WHERE id = 1", (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        let { level, xp } = result.rows[0] || { level: 1, xp: 0 };
        xp += 20; // Gain 20 XP per task

        if (xp >= 100) {
            level += 1;
            xp = 0; // Reset XP on level up
        }

        pool.query("UPDATE stats SET level = $1, xp = $2 WHERE id = 1", [level, xp], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ level, xp });
        });
    });
});

// Get timer state
app.get('/timer-state', (req, res) => {
    pool.query("SELECT time_left FROM timer_state WHERE id = 1", (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(result.rows[0] || { time_left: 1500 });
    });
});

// Update timer state
app.post('/timer-state', (req, res) => {
    const { time_left } = req.body;
    pool.query(
        "INSERT INTO timer_state (id, time_left) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET time_left = EXCLUDED.time_left",
        [time_left],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.sendStatus(200);
        }
    );
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
