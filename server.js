const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from 'public'

// Database Setup
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        createTables();
    }
});

function createTables() {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        firstname TEXT,
        lastname TEXT,
        email TEXT UNIQUE,
        password TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS sensor_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        temperature REAL,
        humidity REAL,
        led_status INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
}

// API Routes

// Register
app.post('/api/register', (req, res) => {
    const { firstname, lastname, email, password } = req.body;

    if (!firstname || !lastname || !email || !password) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    // In a real app, you should hash the password here (e.g., using bcrypt)
    // For simplicity in this demo, we store it as is (NOT RECOMMENDED FOR PRODUCTION)

    const sql = `INSERT INTO users (firstname, lastname, email, password) VALUES (?, ?, ?, ?)`;
    db.run(sql, [firstname, lastname, email, password], function (err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ success: false, message: 'Email already exists.' });
            }
            return res.status(500).json({ success: false, message: err.message });
        }
        res.json({ success: true, message: 'User registered successfully.', userId: this.lastID });
    });
});

// Login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const sql = `SELECT * FROM users WHERE email = ? AND password = ?`;
    db.get(sql, [email, password], (err, row) => {
        if (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
        if (row) {
            res.json({
                success: true,
                message: 'Login successful.',
                user: { id: row.id, firstname: row.firstname, lastname: row.lastname }
            });
        } else {
            res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }
    });
});

// ESP32 Data Endpoint
app.post('/api/esp32', (req, res) => {
    const { temperature, humidity, led_status } = req.body;

    if (temperature === undefined || humidity === undefined) {
        return res.status(400).json({ success: false, message: 'Invalid data.' });
    }

    const sql = `INSERT INTO sensor_data (temperature, humidity, led_status) VALUES (?, ?, ?)`;
    db.run(sql, [temperature, humidity, led_status || 0], function (err) {
        if (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
        res.json({ success: true, message: 'Data received.' });
    });
});

app.get('/api/esp32', (req, res) => {
    const sql = `SELECT * FROM sensor_data ORDER BY created_at DESC LIMIT 1`;
    db.get(sql, [], (err, row) => {
        if (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
        if (row) {
            res.json({ success: true, data: row });
        } else {
            res.json({ success: false, message: 'No data found.' });
        }
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
