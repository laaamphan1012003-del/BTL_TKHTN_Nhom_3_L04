const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const fs = require('fs');
const http = require('http');

const app = express();
const PORT = 3000;

//Cấu hình ESP32
const ESP32_IP_ADDRESS = '192.168.1.170';
const ESP32_PORT = 80; // Cổng HTTP/TCP mà ESP32 đang lắng nghe

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
    //Bảng người dùng
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        firstname TEXT,
        lastname TEXT,
        email TEXT UNIQUE,
        password TEXT,
        last_login DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Bảng trạng thái thiết bị (CHỈ CÓ LED STATUS)
    db.run(`CREATE TABLE IF NOT EXISTS device_status (
        id INTEGER PRIMARY KEY,
        led_status INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error("Lỗi khi tạo bảng device_status:", err.message);
            return;
        }

        // Bản ghi trạng thái ban đầu (VỚI ID = 1)
        db.get(`SELECT COUNT(*) as count FROM device_status`, (err, row) => {
            if (err) return console.error('Lỗi kiểm tra bản ghi device_status:', err.message);
            if (row.count === 0) {
                // SỬ DỤNG id=1 để đơn giản hóa UPDATE sau này
                db.run(`INSERT INTO device_status (id, led_status) VALUES (1, 0)`, (err) => {
                    if (err) console.error('Lỗi khi INSERT device_status ban đầu:', err.message);
                    else console.log('Đã tạo bản ghi device_status ban đầu.');
                });
            }
        });
    });
}

//LED STATUS từ ESP32
function getEsp32LedStatus(callback) {
    const options = {
        hostname: ESP32_IP_ADDRESS,
        port: ESP32_PORT,
        path: '/api/led/status', // Endpoint giả định trên ESP32
        method: 'GET'
    };

    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            if (res.statusCode === 200) {
                try {
                    const jsonResponse = JSON.parse(data);
                    // Expected response: { "led_status": 1 or 0 }
                    callback(null, jsonResponse);
                } catch (e) {
                    callback(new Error('Lỗi Parse JSON từ ESP32: ' + e.message));
                }
            } else {
                callback(new Error(`ESP32 phản hồi lỗi ${res.statusCode}: ${data}`));
            }
        });
    });

    req.on('error', (e) => {
        callback(new Error(`Lỗi kết nối ESP32: ${e.message}`));
    });

    req.end();
}

// Gửi lệnh toggle LED đến ESP32
function postEsp32LedToggle(status, callback) {
    const postData = JSON.stringify({ status: status });

    const options = {
        hostname: ESP32_IP32_ADDRESS,
        port: ESP32_PORT,
        path: '/api/led/toggle', // Endpoint giả định trên ESP32
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            if (res.statusCode === 200) {
                try {
                    callback(null, JSON.parse(data));
                } catch (e) {
                    callback(new Error('Lỗi Parse JSON từ ESP32: ' + e.message));
                }
            } else {
                callback(new Error(`ESP32 phản hồi lỗi ${res.statusCode}: ${data}`));
            }
        });
    });

    req.on('error', (e) => {
        callback(new Error(`Lỗi kết nối ESP32: ${e.message}`));
    });

    req.write(postData);
    req.end();
}

// --- API MODULE STATUS ---

// Kiểm tra trạng thái hệ thống
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        status: {
            server: 'running',
            database: 'connected',
            timestamp: new Date().toISOString()
        }
    });
});

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
    const { led_status } = req.body; //  LED STATUS

    if (led_status === undefined) {
        return res.status(400).json({ success: false, message: 'Thiếu dữ liệu led_status.' });
    }

    // Cập nhật trạng thái LED
    const sql = `UPDATE device_status SET led_status = ?, created_at = CURRENT_TIMESTAMP WHERE id = (SELECT MAX(id) FROM device_status)`;
    db.run(sql, [led_status], function (err) {
        if (err) {
            // Nếu chưa có bản ghi nào, thì insert
            if (this.changes === 0) {
                 db.run(`INSERT INTO device_status (led_status) VALUES (?)`, [led_status], (err) => {
                    if (err) return res.status(500).json({ success: false, message: err.message });
                    res.json({ success: true, message: 'Đã lưu trạng thái LED.' });
                 });
            } else {
                return res.status(500).json({ success: false, message: err.message });
            }
        } else {
            res.json({ success: true, message: 'Đã lưu trạng thái LED.' });
        }
    });
});

// 5. Lấy dữ liệu cho Dashboard
app.get('/api/esp32', (req, res) => {
    // Chỉ lấy trạng thái LED mới nhất
    const sql = `SELECT led_status FROM device_status ORDER BY created_at DESC LIMIT 1`;
    db.get(sql, [], (err, row) => {
        if (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
        const status = row ? row.led_status : 0;
        res.json({ success: true, led_status: status });
    });
});

// 6. Lấy file log.txt
app.get('/api/log', (req, res) => {
    const logPath = path.join(__dirname, 'TKHTN', 'log.txt');
    fs.readFile(logPath, 'utf8', (err, data) => {
        if (err) {
            // Đảm bảo trả về JSON ngay cả khi lỗi
            if (err.code === 'ENOENT') {
                return res.status(404).json({ success: false, message: 'File log.txt không tìm thấy trên server.' });
            }
            return res.status(500).json({ success: false, message: 'Lỗi đọc file log: ' + err.message });
        }
        
        // Trả về nội dung log
        res.json({ success: true, logData: data });
    });
});

//7. Nhận Hex Frame và forward đến ESP32
app.post('/api/send-frame', (req, res) => {
    const { hexFrame } = req.body;

    if (!hexFrame) {
        return res.status(400).json({ success: false, message: 'Thiếu chuỗi Hex Frame.' });
    }

    console.log(`[FORWARD] Nhận Frame Hex từ Web: ${hexFrame}`);

    // Chuẩn bị dữ liệu gửi đến ESP32
    const postData = JSON.stringify({
        frame: hexFrame
    });

    const options = {
        hostname: ESP32_IP_ADDRESS,
        port: ESP32_PORT,
        path: '/receive_frame', // Endpoint trên ESP32
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const esp32Req = http.request(options, (esp32Res) => {
        let data = '';
        esp32Res.on('data', (chunk) => { data += chunk; });
        esp32Res.on('end', () => {
            console.log(`[FORWARD] ESP32 phản hồi: ${esp32Res.statusCode}`);
            // Forward kết quả trả về của ESP32 (nếu có)
            res.status(esp32Res.statusCode).json({
                success: esp32Res.statusCode === 200,
                message: esp32Res.statusCode === 200 ? 'Frame đã được gửi thành công tới ESP32.' : `ESP32 phản hồi lỗi: ${data}`,
                esp32Response: data
            });
        });
    });

    esp32Req.on('error', (e) => {
        console.error(`[FORWARD] Lỗi gửi Frame tới ESP32 (${ESP32_IP_ADDRESS}:${ESP32_PORT}): ${e.message}`);
        res.status(503).json({ success: false, message: `Không thể kết nối với ESP32: ${e.message}` });
    });

    // Gửi dữ liệu đi
    esp32Req.write(postData);
    esp32Req.end();
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