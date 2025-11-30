const API_URL = 'http://localhost:3000/api';

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupSidebar();
    
    // Mặc định load dashboard
    initDashboard();
});

// --- SIDEBAR & TABS ---
function setupSidebar() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
        document.getElementById('sidebar-username').innerText = `${user.firstname} ${user.lastname}`;
        document.getElementById('sidebar-email').innerText = user.email;
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
async function loadUsers() {
    const tableBody = document.getElementById('user-table-body');
    if(!tableBody) return;
    
    tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading data...</td></tr>';

    try {
        const response = await fetch(`${API_URL}/users`);
        const result = await response.json();

        if (result.success) {
            tableBody.innerHTML = '';
            result.data.forEach(user => {
                const regDate = new Date(user.created_at).toLocaleString();
                const lastLogin = user.last_login ? new Date(user.last_login).toLocaleString() : 'Never';
                
                const row = `
                    <tr>
                        <td>#${user.id}</td>
                        <td style="font-weight:500; color:#333;">${user.firstname} ${user.lastname}</td>
                        <td>${user.email}</td>
                        <td>${regDate}</td>
                        <td><span style="color:${user.last_login ? '#50cd89' : '#b5b5c3'}">${lastLogin}</span></td>
                    </tr>
                `;
                tableBody.insertAdjacentHTML('beforeend', row);
            });
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
function initDashboard() {
    fetchSensorData();
    // Gọi mỗi 2 giây
    setInterval(fetchSensorData, 2000);
}

async function fetchSensorData() {
    try {
        const response = await fetch(`${API_URL}/esp32`);
        const result = await response.json();
        if (result.success && result.data.length > 0) {
            updateLogs(result.data[result.data.length - 1]);
        }
    } catch (e) { console.error('Log fetch error', e); }
}

let lastLogId = null;
function updateLogs(data) {
    const logList = document.getElementById('log-list');
    if (!logList) return;
    
    const currentId = data.id || data.created_at;
    if (lastLogId === currentId) return;
    lastLogId = currentId;

    const now = new Date().toLocaleTimeString();
    const logMsg = `<div class="log-item"><span class="timestamp">[${now}]</span> Temp: ${data.temperature}°C | Humid: ${data.humidity}%</div>`;
    
    logList.insertAdjacentHTML('afterbegin', logMsg);
    if (logList.children.length > 50) logList.removeChild(logList.lastChild);
}