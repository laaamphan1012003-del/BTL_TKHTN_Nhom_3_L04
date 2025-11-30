const API_URL = 'http://localhost:3000/api';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form');
    const errorMessage = document.getElementById('error-message');

    // Kiểm tra thông báo từ URL (ví dụ: sau khi đăng ký thành công)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('registered') === 'true' && errorMessage) {
        errorMessage.style.color = 'var(--success-color)';
        errorMessage.innerText = 'Đăng ký thành công! Vui lòng đăng nhập.';
    }

    // Xử lý Form (Đăng nhập & Đăng ký)
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (errorMessage) errorMessage.innerText = '';

            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());

            // Validate cơ bản phía Client
            if (!validateForm(data)) return;

            // Xác định là Đăng nhập hay Đăng ký dựa vào input 'firstname'
            const isRegister = data.hasOwnProperty('firstname');

            if (isRegister) {
                await registerUser(data);
            } else {
                await loginUser(data);
            }
        });
    }
});

// --- Authentication Logic ---

async function registerUser(userData) {
    const errorMessage = document.getElementById('error-message');
    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });

        const result = await response.json();

        if (result.success) {
            window.location.href = 'login.html?registered=true';
        } else {
            errorMessage.style.color = 'var(--error-color)';
            errorMessage.innerText = result.message || 'Đăng ký thất bại.';
        }
    } catch (error) {
        errorMessage.innerText = 'Lỗi kết nối Server.';
        console.error(error);
    }
}

async function loginUser(userData) {
    const errorMessage = document.getElementById('error-message');
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });

        const result = await response.json();

        if (result.success) {
            // Lưu thông tin user vào localStorage
            localStorage.setItem('user', JSON.stringify(result.user));
            // Chuyển hướng vào Dashboard
            window.location.href = 'dashboard/index.html';
        } else {
            errorMessage.style.color = 'var(--error-color)';
            errorMessage.innerText = result.message || 'Đăng nhập thất bại.';
        }
    } catch (error) {
        errorMessage.innerText = 'Lỗi kết nối Server.';
        console.error(error);
    }
}

// --- Validation Logic ---

function validateForm(data) {
    const errorMessage = document.getElementById('error-message');
    errorMessage.style.color = 'var(--error-color)';

    if (data.email && !validateEmail(data.email)) {
        errorMessage.innerText = 'Định dạng email không hợp lệ.';
        return false;
    }

    if (data.password && data.password.length < 6) {
        errorMessage.innerText = 'Mật khẩu phải có ít nhất 6 ký tự.';
        return false;
    }

    if (data['repeat-password'] && data.password !== data['repeat-password']) {
        errorMessage.innerText = 'Mật khẩu nhập lại không khớp.';
        return false;
    }

    return true;
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}