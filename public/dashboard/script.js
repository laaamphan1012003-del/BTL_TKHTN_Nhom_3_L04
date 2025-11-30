const API_URL = 'http://localhost:3000/api';

document.addEventListener('DOMContentLoaded', () => {
    checkAuth(); // Kiểm tra đăng nhập
    initDashboard(); // Khởi chạy biểu đồ và lấy dữ liệu
});

// 1. Kiểm tra Auth & Logout
function checkAuth() {
    const user = localStorage.getItem('user');
    if (!user) {
        // Nếu chưa đăng nhập, đá về trang login
        window.location.href = '../login.html';
    }
}

function logout() {
    localStorage.removeItem('user');
    window.location.href = '../login.html';
}

// 2. Khởi tạo Dashboard
let chartCtx;

function initDashboard() {
    const canvas = document.getElementById('sensorChart');
    if (canvas) {
        // Set kích thước canvas theo khung chứa
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
        chartCtx = canvas.getContext('2d');
    }

    // Gọi dữ liệu ngay lập tức
    fetchSensorData();

    // Cập nhật định kỳ 2 giây/lần
    setInterval(fetchSensorData, 2000);
}

// 3. Lấy dữ liệu từ Server
async function fetchSensorData() {
    try {
        const response = await fetch(`${API_URL}/esp32`);
        const result = await response.json();

        if (result.success && result.data.length > 0) {
            const latest = result.data[result.data.length - 1]; // Phần tử mới nhất
            
            // Cập nhật số liệu hiển thị
            updateDashboardUI(latest);

            // Vẽ biểu đồ
            drawChart(result.data);
            
            // Cập nhật log (giả lập log dựa trên dữ liệu)
            updateLogs(latest);
        }
    } catch (error) {
        console.error('Lỗi lấy dữ liệu cảm biến:', error);
    }
}

function updateDashboardUI(data) {
    const tempEl = document.getElementById('temp-value');
    const humidEl = document.getElementById('humid-value');
    
    if (tempEl) tempEl.innerText = data.temperature.toFixed(1) + ' °C';
    if (humidEl) humidEl.innerText = data.humidity.toFixed(1) + ' %';
}

function updateLogs(data) {
    const logList = document.getElementById('log-list');
    if (!logList) return;

    // Chỉ thêm log nếu chưa có (đơn giản hóa cho demo)
    const now = new Date().toLocaleTimeString();
    const logMsg = `<span class="timestamp">[${now}]</span> Data received: Temp ${data.temperature}°C, Humid ${data.humidity}%`;
    
    // Tạo phần tử log mới
    const newItem = document.createElement('div');
    newItem.className = 'log-item';
    newItem.innerHTML = logMsg;

    // Thêm vào đầu danh sách
    logList.insertBefore(newItem, logList.firstChild);

    // Giới hạn 20 dòng log
    if (logList.children.length > 20) {
        logList.removeChild(logList.lastChild);
    }
}

// 4. Vẽ biểu đồ (Thủ công, không cần thư viện ngoài)
function drawChart(dataArray) {
    if (!chartCtx) return;

    const width = chartCtx.canvas.width;
    const height = chartCtx.canvas.height;
    const padding = 40;

    // Xóa canvas cũ
    chartCtx.clearRect(0, 0, width, height);

    // Vẽ trục tọa độ
    chartCtx.beginPath();
    chartCtx.strokeStyle = '#ccc';
    chartCtx.lineWidth = 1;
    chartCtx.moveTo(padding, padding);
    chartCtx.lineTo(padding, height - padding);
    chartCtx.lineTo(width - padding, height - padding);
    chartCtx.stroke();

    // Hàm ánh xạ giá trị (Mapping)
    const mapX = (i) => padding + (i / (dataArray.length - 1 || 1)) * (width - 2 * padding);
    const mapY = (val, min, max) => height - padding - ((val - min) / (max - min)) * (height - 2 * padding);

    // Vẽ đường Nhiệt độ (Đỏ)
    if (dataArray.length > 1) {
        chartCtx.beginPath();
        chartCtx.strokeStyle = '#d32f2f';
        chartCtx.lineWidth = 2;
        dataArray.forEach((item, i) => {
            const x = mapX(i);
            const y = mapY(item.temperature, 0, 50); // Scale nhiệt độ 0-50
            if (i === 0) chartCtx.moveTo(x, y);
            else chartCtx.lineTo(x, y);
        });
        chartCtx.stroke();
    }

    // Vẽ đường Độ ẩm (Xanh)
    if (dataArray.length > 1) {
        chartCtx.beginPath();
        chartCtx.strokeStyle = '#0288d1';
        chartCtx.lineWidth = 2;
        dataArray.forEach((item, i) => {
            const x = mapX(i);
            const y = mapY(item.humidity, 0, 100); // Scale độ ẩm 0-100
            if (i === 0) chartCtx.moveTo(x, y);
            else chartCtx.lineTo(x, y);
        });
        chartCtx.stroke();
    }
}