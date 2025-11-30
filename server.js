const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');

const app = express();
const PORT = 3000;

// --- MIDDLEWARE & STATIC FILES ---
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Database Setup
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error('Lỗi kết nối database:', err.message);
    } else {
        console.log('Đã kết nối tới SQLite database.');
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
        last_login DATETIME,
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

// --- API ROUTES ---

// 1. Đăng ký
app.post('/api/register', async (req, res) => {
    const { firstname, lastname, email, password } = req.body;

    if (!firstname || !lastname || !email || !password) {
        return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ thông tin.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const sql = `INSERT INTO users (firstname, lastname, email, password) VALUES (?, ?, ?, ?)`;
        db.run(sql, [firstname, lastname, email, hashedPassword], function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ success: false, message: 'Email này đã được sử dụng.' });
                }
                return res.status(500).json({ success: false, message: err.message });
            }
            res.json({ success: true, message: 'Đăng ký thành công.', userId: this.lastID });
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server.' });
    }
});

// 2. Đăng nhập
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập email và mật khẩu.' });
    }

    const sql = `SELECT * FROM users WHERE email = ?`;
    db.get(sql, [email], async (err, user) => {
        if (err) return res.status(500).json({ success: false, message: 'Lỗi database.' });
        if (!user) return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng.' });

        const match = await bcrypt.compare(password, user.password);
        if (match) {
            // Cập nhật thời gian đăng nhập lần cuối
            db.run(`UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?`, [user.id]);
            
            res.json({
                success: true,
                message: 'Đăng nhập thành công.',
                user: { id: user.id, firstname: user.firstname, lastname: user.lastname, email: user.email }
            });
        } else {
            res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng.' });
        }
    });
});

// 3. Lấy danh sách Users
app.get('/api/users', (req, res) => {
    const sql = `SELECT id, firstname, lastname, email, created_at, last_login FROM users ORDER BY created_at DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, data: rows });
    });
});

// 4. Nhận dữ liệu từ ESP32
app.post('/api/esp32', (req, res) => {
    const { temperature, humidity, led_status } = req.body;
    console.log('Nhận dữ liệu từ ESP32:', req.body);

    if (temperature === undefined || humidity === undefined) {
        return res.status(400).json({ success: false, message: 'Thiếu dữ liệu cảm biến.' });
    }

    const sql = `INSERT INTO sensor_data (temperature, humidity, led_status) VALUES (?, ?, ?)`;
    db.run(sql, [temperature, humidity, led_status || 0], function (err) {
        if (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
        res.json({ success: true, message: 'Đã lưu dữ liệu.' });
    });
});

// 5. Lấy dữ liệu cho Dashboard
app.get('/api/esp32', (req, res) => {
    const sql = `SELECT * FROM sensor_data ORDER BY created_at DESC LIMIT 20`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
        res.json({ success: true, data: rows.reverse() });
    });
});

// --- SERVER START & GRACEFUL SHUTDOWN ---

const server = app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
});

// Lắng nghe sự kiện ngắt server (Ctrl + C)
process.on('SIGINT', () => {
    console.log('\nĐang ngắt kết nối Server...');
    
    server.close(() => {
        console.log(`Đã đóng cổng ${PORT}. Dọn dẹp hoàn tất.`);
        
        db.close((err) => {
            if (err) console.error(err.message);
            else console.log('Đã đóng kết nối Database.');
            
            process.exit(0);
        });
    });
});