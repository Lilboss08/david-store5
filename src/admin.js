import { getStoredUser, getAuthToken, isAdmin, logout, isLoggedIn } from './auth.js';

// Check if user is logged in and is admin
if (!isLoggedIn() || !isAdmin()) {
    console.error('Admin access required');
    document.body.innerHTML = `
        <div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
            <h1 style="color: #dc3545;">Admin Access Required</h1>
            <p>You must be logged in as an administrator to access this page.</p>
            <a href="login.html" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Go to Login</a>
        </div>
    `;
    throw new Error('Admin access required');
}

const messageEl = document.getElementById('adminMessage');
const form = document.getElementById('adminProductForm');
const productIdEl = document.getElementById('productId');
const titleEl = document.getElementById('prodTitle');
const descriptionEl = document.getElementById('prodDescription');
const priceEl = document.getElementById('prodPrice');
const categoryEl = document.getElementById('prodCategory');
const imageEl = document.getElementById('prodImage');
const stockEl = document.getElementById('prodStock');
const tableBody = document.querySelector('#productsTable tbody');

console.log('Admin page loaded, user:', getStoredUser());

function setMessage(text, type = 'success') {
    messageEl.textContent = text;
    messageEl.className = `form-message ${type}`;
}

function clearForm() {
    productIdEl.value = '';
    titleEl.value = '';
    descriptionEl.value = '';
    priceEl.value = '';
    categoryEl.value = '';
    imageEl.value = '';
    stockEl.value = 0;
    setMessage('Form cleared.');
}

async function apiRequest(path, options = {}) {
    const token = getAuthToken();
    console.log('API Request Token:', token ? 'Token present' : 'No token found');
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    if (token) {
        headers.Authorization = `Bearer ${token}`;
        console.log('Authorization header set');
    } else {
        console.error('No authentication token available!');
    }

    console.log('Making request to:', path);
    const res = await fetch(`http://localhost:4000${path}`, {
        ...options,
        headers
    });
    
    console.log('Response status:', res.status);

    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error('API Error:', res.status, errData);
        throw new Error(errData.message || `Request failed ${res.status}`);
    }

    // For 204 No Content, return empty object
    if (res.status === 204) {
        return {};
    }

    return res.json();
}

async function loadProducts() {
    try {
        const products = await apiRequest('/api/v1/products', { method: 'GET' });
        tableBody.innerHTML = '';

        products.forEach(product => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${product.id}</td>
                <td>${product.title || product.name}</td>
                <td>${product.category || 'Uncategorized'}</td>
                <td>$${Number(product.price).toFixed(2)}</td>
                <td>${product.stock ?? 0}</td>
                <td>
                    <button class="edit-btn">Edit</button>
                    <button class="delete-btn">Delete</button>
                </td>
            `;

            row.querySelector('.edit-btn').addEventListener('click', () => {
                productIdEl.value = product.id;
                titleEl.value = product.title || product.name || '';
                descriptionEl.value = product.description || '';
                priceEl.value = product.price || 0;
                categoryEl.value = product.category || '';
                imageEl.value = product.image || '';
                stockEl.value = product.stock ?? 0;
                setMessage('Editing product id ' + product.id);
            });

            row.querySelector('.delete-btn').addEventListener('click', async () => {
                if (!confirm('Delete this product permanently?')) return;
                try {
                    console.log('Deleting product id:', product.id, typeof product.id);
                    await apiRequest(`/api/v1/products/${product.id}`, { method: 'DELETE' });
                    setMessage('Product deleted');
                    loadProducts();
                } catch (err) {
                    console.error('Delete error:', err);
                    setMessage(err.message, 'error');
                }
            });

            tableBody.appendChild(row);
        });
    } catch (err) {
        setMessage('Could not load products: ' + err.message, 'error');
    }
}

form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const id = productIdEl.value;
    const payload = {
        title: titleEl.value.trim(),
        description: descriptionEl.value.trim(),
        price: Number(priceEl.value),
        category: categoryEl.value.trim(),
        image: imageEl.value.trim(),
        stock: Number(stockEl.value)
    };

    try {
        if (!payload.title || isNaN(payload.price) || payload.price < 0 || isNaN(payload.stock) || payload.stock < 0) {
            throw new Error('Please enter valid title, price, and stock values.');
        }

        if (id) {
            await apiRequest(`/api/v1/products/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(payload)
            });
            setMessage('Product updated.');
        } else {
            await apiRequest('/api/v1/products', {
                method: 'POST',
                body: JSON.stringify(payload)
            }).catch(error => {
                console.error('Error adding product:', error);
                if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                    setMessage('Admin login required. Please log out and log back in as admin.', 'error');
                } else if (error.message.includes('403') || error.message.includes('Admin')) {
                    setMessage('Admin access required. Your account may not have admin privileges.', 'error');  
                } else {
                    setMessage('Error adding product: ' + error.message, 'error');
                }
                throw error;
            });
            setMessage('Product created.');
        }

        clearForm();
        loadProducts();
    } catch (err) {
        setMessage(err.message, 'error');
    }
});

document.getElementById('clearForm').addEventListener('click', clearForm);

function renderAuthLinks() {
    const authContainer = document.getElementById('auth-links');
    if (!authContainer) return;

    if (isLoggedIn()) {
        const user = getStoredUser();
        authContainer.innerHTML = `<span class="user-greeting">Hi, ${user.fullName || user.email || 'Admin'}</span> <button id="logoutBtn" class="auth-btn">Logout</button>`;
        document.getElementById('logoutBtn').addEventListener('click', logout);
    } else {
        authContainer.innerHTML = `<a href="login.html" class="auth-btn">Login</a>`;
    }
}

function initAdminPage() {
    if (!isLoggedIn() || !isAdmin()) {
        window.location.href = 'index.html';
        return;
    }

    renderAuthLinks();
    loadProducts();
}

initAdminPage();