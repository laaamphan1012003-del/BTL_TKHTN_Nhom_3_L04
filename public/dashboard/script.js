const API_URL = 'http://localhost:3000/api';

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupSidebar();
    
    // Mặc định load dashboard
    initDashboard();

    //Listener nút toggle LED
    const toggleBtn = document.getElementById('toggle-led-btn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleLED);
    }
});

// --- SIDEBAR & TABS ---
function setupSidebar() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
        document.getElementById('sidebar-username').innerText = `${user.firstname || 'User'} ${user.lastname || 'Name'}`;
        document.getElementById('sidebar-email').innerText = user.email || 'No email';
    }

    const toggleBtn = document.getElementById('toggle-btn');
    const sidebar = document.getElementById('sidebar');
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });
    }
}

window.switchTab = function(tabName) {
    // 1. Highlight nút active
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    
    const activeBtn = event.currentTarget;
    if(activeBtn) activeBtn.classList.add('active');

    // 2. Chuyển View
    const views = document.querySelectorAll('.view-section');
    views.forEach(v => v.classList.remove('active'));

    if (tabName === 'dashboard') {
        const dbView = document.getElementById('view-dashboard');
        if(dbView) dbView.classList.add('active');
    } else if (tabName === 'users') {
        const usersView = document.getElementById('view-users');
        if(usersView) {
            usersView.classList.add('active');
            loadUsers();
        }
    }
};

// --- USER MANAGEMENT ---
window.loadUsers = async function() {
    const tableBody = document.getElementById('user-table-body');
    tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading users...</td></tr>';
    try {
        const response = await fetch(`${API_URL}/users`);
        const result = await response.json();
        
        if (result.success && result.data && result.data.length > 0) {
            tableBody.innerHTML = result.data.map(user => `
                <tr>
                    <td>${user.id}</td>
                    <td>${user.firstname} ${user.lastname}</td>
                    <td>${user.email}</td>
                    <td>${new Date(user.created_at).toLocaleDateString()}</td>
                    <td>${user.last_login ? new Date(user.last_login).toLocaleString() : 'N/A'}</td>
                </tr>
            `).join('');
        } else {
            tableBody.innerHTML = '<tr><td colspan="5" style="color:gray; text-align:center;">No registered users found.</td></tr>';
        }

    } catch (error) {
        tableBody.innerHTML = '<tr><td colspan="5" style="color:red; text-align:center;">Error loading users</td></tr>';
        console.error(error);
    }
}

// --- AUTH ---
function checkAuth() {
    const user = localStorage.getItem('user');
    if (!user) window.location.href = '../login.html';
}

window.logout = function() {
    localStorage.removeItem('user');
    window.location.href = '../login.html';
};

// --- DASHBOARD REALTIME ---
let sensorChart = null;
let lastLogId = null;

function initDashboard() {
    loadDeviceStatus();
    fetchActivityLog();
    // Gọi mỗi 2 giây
    if (typeof window.logInterval === 'undefined') {
        window.logInterval = setInterval(fetchActivityLog, 2000); 
    };
}

// Load trạng thái LED
async function loadDeviceStatus() {
    const statusElement = document.getElementById('led-status');
    const toggleBtn = document.getElementById('toggle-led-btn');
    if (!statusElement || !toggleBtn) return;

    statusElement.textContent = 'Đang tải...';
    statusElement.className = 'status-indicator pending';
    toggleBtn.disabled = true;

    fetch(`${API_URL}/device/led/status`)
        .then(res => res.json())
        .then(data => {
            toggleBtn.disabled = false;
            if (data.success) {
                const status = data.led_status === 1 ? 'ON' : 'OFF';
                statusElement.textContent = status;
                statusElement.className = data.led_status === 1 ? 'status-indicator active' : 'status-indicator inactive';
                document.getElementById('status-message').textContent = `Cập nhật trạng thái lúc: ${new Date().toLocaleTimeString('vi-VN')}`;
            } else {
                statusElement.textContent = 'Lỗi';
                statusElement.className = 'status-indicator error';
                document.getElementById('status-message').textContent = `Lỗi: ${data.message || 'Không thể lấy trạng thái LED'}`;
            }
        })
        .catch(err => {
            toggleBtn.disabled = true;
            statusElement.textContent = 'Lỗi K/N';
            statusElement.className = 'status-indicator error';
            document.getElementById('status-message').textContent = `Lỗi kết nối Server: ${err.message}`;
        });
}

// Toggle LED trạng thái
async function toggleLED() {
    const currentStatusElement = document.getElementById('led-status');
    if (!['ON', 'OFF'].includes(currentStatusElement.textContent)) return; 

    const currentStatus = currentStatusElement.textContent === 'ON' ? 1 : 0;
    const newStatus = 1 - currentStatus; // Đảo trạng thái

    currentStatusElement.textContent = '...Đang gửi lệnh...';
    currentStatusElement.style.color = '#ffc700';

    try {
        const response = await fetch(`${API_URL}/esp32`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ led_status: newStatus })
        });
        const result = await response.json();

        if (result.success) {
            await loadDeviceStatus(); 
            console.log('Lệnh LED thành công:', newStatus);
        } else {
            alert('Lỗi khi gửi lệnh LED: ' + result.message);
            await loadDeviceStatus(); 
        }
    } catch (e) {
        alert('Lỗi kết nối Server khi gửi lệnh LED.');
        await loadDeviceStatus(); 
    }
}

async function fetchActivityLog() {
    const logList = document.getElementById('log-list');
    if (!logList) return; 

    // Ghi trạng thái đang tải
    logList.innerHTML = `<p class="log-item log-info">Đang tải...</p>`;

    fetch('/api/log')
        .then(response => {
            if (!response.ok) {
                // Xử lý lỗi HTTP (ví dụ: 404 Not Found)
                return response.json().then(errorData => {
                    throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
                });
            }
            return response.json();
        })
        .then(result => {
            if (result.success && result.logData) {
                logList.innerHTML = ''; // Xóa nội dung "Đang tải"
                const logLines = result.logData.trim().split('\n').filter(line => line.length > 0);

                if (logLines.length === 0) {
                    logList.innerHTML = `<p class="log-item log-info">File log rỗng hoặc không có FaceID nào được ghi lại.</p>`;
                } else {
                    logLines.forEach(line => {
                        const parts = line.split(',');
                        let content = line;
                        let className = 'log-info'; // Mặc định là thông tin

                        if (parts.length >= 2) {
                            const name = parts[0].trim();
                            // Thử parse và format lại ngày, nếu không được thì hiển thị thô
                            let timestamp = parts[1].trim();
                            try {
                                const date = new Date(timestamp);
                                timestamp = date.toLocaleString('vi-VN');
                            } catch (e) {
                                // Nếu parse lỗi, dùng nguyên timestamp thô
                            }

                            content = `[${timestamp}] - ĐĂNG NHẬP: ${name}`;
                            className = 'log-success';
                        }

                        const logItem = document.createElement('p');
                        logItem.className = 'log-item ' + className;
                        logItem.textContent = content;
                        logList.appendChild(logItem);
                    });
                }
            
            // Cuộn xuống dòng cuối cùng
            logList.scrollTop = logList.scrollHeight;

        } else {
            // Xử lý lỗi từ server (404 hoặc 500)
            logList.innerHTML = `<p class="log-item log-error">Lỗi Server: ${result.message || 'không có lỗi'}</p>`;
            console.error('Lỗi khi lấy log:', result.message);
        }
    })
     .catch (error => {
        logList.innerHTML = '<p class="log-item log-error">Lỗi kết nối Server API /api/log.</p>';
        console.error('Lỗi kết nối API /api/log:', error);
    })
}