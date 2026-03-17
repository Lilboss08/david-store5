// Auth utilities for protected pages
export function getStoredUser() {
    try {
        return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
        return null;
    }
}

export function getAuthToken() {
    const token = localStorage.getItem('token');
    if (token) return token;
    const user = getStoredUser();
    return user?.token || null;
}

export function isLoggedIn() {
    return Boolean(getAuthToken());
}

export function logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('cart'); // Optional: clear cart on logout
    window.location.href = 'index.html';
}

export function requireLogin(message = 'You must be logged in to perform this action.') {
    if (isLoggedIn()) return true;
    // Store current URL for redirect after login
    localStorage.setItem('redirectAfterLogin', window.location.href);
    if (confirm(`${message}\n\nWould you like to go to the login page now?`)) {
        window.location.href = 'login.html';
    }
    return false;
}

export function protectPage() {
    if (!isLoggedIn()) {
        localStorage.setItem('redirectAfterLogin', window.location.pathname.substring(1) || 'index.html');
        window.location.href = 'login.html';
        return false;
    }
    return true;
}