document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form');
    const errorMessage = document.getElementById('error-message');

    // Check for registration success
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('registered') === 'true') {
        errorMessage.style.color = 'var(--success-color)';
        errorMessage.innerText = 'Registration successful! Please log in.';
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorMessage.innerText = '';

            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());

            // Basic Client-side Validation
            if (!validateForm(data)) return;

            const isLogin = !data.hasOwnProperty('firstname'); // Simple check to distinguish login vs register

            // CLIENT-SIDE LOGIC (No Backend)
            if (isLogin) {
                if (loginUser(data.email, data.password)) {
                    window.location.href = 'dashboard/index.html';
                } else {
                    errorMessage.style.color = 'var(--error-color)';
                    errorMessage.innerText = 'Invalid email or password.';
                }
            } else {
                if (registerUser(data)) {
                    window.location.href = 'login.html?registered=true';
                } else {
                    errorMessage.style.color = 'var(--error-color)';
                    errorMessage.innerText = 'Email already exists.';
                }
            }
        });
    }

    // Dashboard Logic
    if (window.location.pathname.includes('dashboard')) {
        // Check if logged in
        const user = localStorage.getItem('currentUser');
        if (!user) {
            window.location.href = '../login.html';
            return;
        }

        initDashboard();
    }
});

function validateForm(data) {
    const errorMessage = document.getElementById('error-message');
    errorMessage.style.color = 'var(--error-color)';

    if (data.email && !validateEmail(data.email)) {
        errorMessage.innerText = 'Invalid email format.';
        return false;
    }

    if (data.password && data.password.length < 8) {
        errorMessage.innerText = 'Password must be at least 8 characters.';
        return false;
    }

    if (data['repeat-password'] && data.password !== data['repeat-password']) {
        errorMessage.innerText = 'Passwords do not match.';
        return false;
    }

    return true;
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// --- Client-Side Storage Logic ---

function getUsers() {
    const users = localStorage.getItem('users');
    return users ? JSON.parse(users) : [];
}

function registerUser(userData) {
    const users = getUsers();

    // Check if email exists
    if (users.find(u => u.email === userData.email)) {
        return false;
    }

    const newUser = {
        id: Date.now(),
        firstname: userData.firstname,
        lastname: userData.lastname,
        email: userData.email,
        password: userData.password
    };

    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));
    return true;
}

function loginUser(email, password) {
    const users = getUsers();
    const user = users.find(u => u.email === email && u.password === password);

    if (user) {
        localStorage.setItem('currentUser', JSON.stringify(user));
        return true;
    }
    return false;
}

function logout() {
    localStorage.removeItem('currentUser');
    window.location.href = '../login.html';
}

// --- Dashboard & Tab Logic ---

function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    // Show selected tab
    document.getElementById(tabName + '-tab').classList.add('active');

    // Update Sidebar
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    // Find the nav item that triggered this (simple approach: check text content or index)
    // For simplicity, we'll just toggle based on the call
    const navItems = document.querySelectorAll('.nav-item');
    if (tabName === 'iot') navItems[0].classList.add('active');
    if (tabName === 'face') navItems[1].classList.add('active');
}

// --- Advanced Dashboard Logic ---

let chartCtx;
let chartData = {
    labels: [],
    temp: [],
    humid: []
};

function initDashboard() {
    // Initialize Chart
    const canvas = document.getElementById('sensorChart');
    if (canvas) {
        // Resize canvas to fit container
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
        chartCtx = canvas.getContext('2d');
    }

    // Initial Data
    for (let i = 0; i < 20; i++) {
        updateData();
    }
    drawChart();

    // Start Simulation
    setInterval(() => {
        updateData();
        drawChart();
        addRandomLog();
    }, 2000);
}

function updateData() {
    const now = new Date();
    const timeLabel = now.getHours() + ':' + now.getMinutes() + ':' + now.getSeconds();

    const temp = (22 + Math.random() * 5).toFixed(1);
    const humid = (50 + Math.random() * 20).toFixed(1);

    // Update DOM
    const tempEl = document.getElementById('temp-value');
    const humidEl = document.getElementById('humid-value');
    if (tempEl) tempEl.innerText = temp + ' °C';
    if (humidEl) humidEl.innerText = humid + ' %';

    // Update Chart Data
    chartData.labels.push(timeLabel);
    chartData.temp.push(temp);
    chartData.humid.push(humid);

    // Keep only last 20 points
    if (chartData.labels.length > 20) {
        chartData.labels.shift();
        chartData.temp.shift();
        chartData.humid.shift();
    }
}

function drawChart() {
    if (!chartCtx) return;

    const width = chartCtx.canvas.width;
    const height = chartCtx.canvas.height;
    const padding = 30;

    // Clear
    chartCtx.clearRect(0, 0, width, height);

    // Draw Axes
    chartCtx.beginPath();
    chartCtx.strokeStyle = '#ccc';
    chartCtx.moveTo(padding, padding);
    chartCtx.lineTo(padding, height - padding);
    chartCtx.lineTo(width - padding, height - padding);
    chartCtx.stroke();

    // Helper to map value to Y coordinate
    const mapY = (val, min, max) => {
        return height - padding - ((val - min) / (max - min)) * (height - 2 * padding);
    };

    // Helper to map index to X coordinate
    const mapX = (index, count) => {
        return padding + (index / (count - 1)) * (width - 2 * padding);
    };

    // Draw Temp Line (Red)
    chartCtx.beginPath();
    chartCtx.strokeStyle = '#d32f2f';
    chartCtx.lineWidth = 2;
    chartData.temp.forEach((val, i) => {
        const x = mapX(i, chartData.temp.length);
        const y = mapY(val, 15, 35); // Range 15-35
        if (i === 0) chartCtx.moveTo(x, y);
        else chartCtx.lineTo(x, y);
    });
    chartCtx.stroke();

    // Draw Humid Line (Blue)
    chartCtx.beginPath();
    chartCtx.strokeStyle = '#0288d1';
    chartCtx.lineWidth = 2;
    chartData.humid.forEach((val, i) => {
        const x = mapX(i, chartData.humid.length);
        const y = mapY(val, 30, 90); // Range 30-90
        if (i === 0) chartCtx.moveTo(x, y);
        else chartCtx.lineTo(x, y);
    });
    chartCtx.stroke();
}

function addRandomLog() {
    const events = [
        "Motion detected in Kitchen",
        "Living Room Light turned ON",
        "Bedroom Temp > 25°C",
        "Main Door Locked",
        "System Backup Completed"
    ];

    if (Math.random() > 0.7) { // Only add log 30% of the time
        const logList = document.getElementById('log-list');
        if (!logList) return;

        const event = events[Math.floor(Math.random() * events.length)];
        const now = new Date().toLocaleTimeString();

        const item = document.createElement('div');
        item.className = 'log-item';
        item.innerHTML = `<span class="timestamp">[${now}]</span> ${event}`;

        logList.prepend(item);

        // Limit logs
        if (logList.children.length > 20) {
            logList.removeChild(logList.lastChild);
        }
    }
}

// --- Face Attendance Simulation ---

function simulateScan() {
    const statusEl = document.getElementById('scan-status');
    statusEl.style.display = 'block';
    statusEl.innerText = 'Scanning...';
    statusEl.style.color = 'white';

    setTimeout(() => {
        const names = ["John Doe", "Jane Smith", "Unknown", "Admin User"];
        const result = names[Math.floor(Math.random() * names.length)];

        statusEl.innerText = `Identified: ${result}`;
        statusEl.style.color = '#4caf50'; // Green

        addScanResult(result);
    }, 2000);
}

function simulateCapture() {
    const statusEl = document.getElementById('scan-status');
    statusEl.style.display = 'block';
    statusEl.innerText = 'Capturing Image...';

    setTimeout(() => {
        statusEl.innerText = 'Image Saved to Database';
        statusEl.style.color = '#2196f3'; // Blue
    }, 1500);
}

function addScanResult(name) {
    const container = document.getElementById('recent-scans');
    if (!container) return;

    const item = document.createElement('div');
    item.className = 'scan-item';
    // Use a placeholder avatar
    item.innerHTML = `
        <div class="scan-img" style="background: #ccc;"></div>
        <p>${name}</p>
        <small>${new Date().toLocaleTimeString()}</small>
    `;

    container.prepend(item);
}
