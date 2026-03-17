// imported libraries (AOS still loaded via CDN in HTML)
import { getStoredUser, getAuthToken, isLoggedIn, logout, requireLogin } from './auth.js';
const productSchema = {
    id: 'number',
    title: 'string',
    description: 'string',
    price: 'number',
    category: 'string',
    image: 'string',
    rating: 'object' // { rate:number, count:number }
};

function validateProduct(obj) {
    for (const key in productSchema) {
        const type = productSchema[key];
        if (type === 'object') {
            if (typeof obj[key] !== 'object') return false;
        } else if (typeof obj[key] !== type) {
            return false;
        }
    }
    return true;
}

// initialize AOS when available on any page
if (typeof AOS !== 'undefined') {
    AOS.init({
        duration: 1000,
        once: true,
        offset: 100
    });
}

// entire previous script.js content
let products = []; // Will be populated from backend and merged with local list
let currentCategory = 'All'; // Track current category filter

// helper: merge two product arrays by id, backend overrides frontend
function mergeProducts(localList, backendList) {
    const map = new Map();
    localList.forEach(p => { if (p && p.id != null) map.set(p.id, p); });
    backendList.forEach(p => { if (p && p.id != null) map.set(p.id, p); });
    return Array.from(map.values());
}

// Helper function to get category icons
function getCategoryIcon(category) {
    const categoryIcons = {
        'electronics': '\uD83D\uDCF1',
        'men\'s clothing': '\uD83D\uDC54',
        'women\'s clothing': '\uD83D\uDC57',
        'jewelery': '\uD83D\uDC8E',
        'books': '\uD83D\uDCDA',
        'home': '\uD83C\uDFE0',
        'sports': '\u26BD',
        'Uncategorized': '\uD83D\uDCE6'
    };
    
    const lowerCategory = category.toLowerCase();
    return categoryIcons[lowerCategory] || '\uD83D\uDCE6';
}

// Helper function to update active category indicator
function updateActiveCategoryIndicator(activeCategory) {
    // Remove active class from all dropdown items
    const dropdownItems = document.querySelectorAll('.dropdown-content a');
    dropdownItems.forEach(item => item.classList.remove('active-category'));
    
    // Add active class to current category
    const activeItem = Array.from(dropdownItems).find(item => {
        const onclickText = item.getAttribute('onclick');
        return onclickText && (
            onclickText.includes(`'${activeCategory}'`) || 
            (activeCategory === 'All' && onclickText.includes('displayProducts()'))
        );
    });
    
    if (activeItem) {
        activeItem.classList.add('active-category');
    }
}


const fallbackProducts = [
    {id: 1, name: "Iphone 14 Pro", price: 1200, img: "iphone14pro.jpg"},
    {id: 2, name: "Iphone 15 Pro", price: 1300, img: "iphone_15_pro.jpg"},
    {id: 3, name: "Iphone 16 Pro", price: 1000, img: "iphone16pro.jpg"},
    {id: 4, name: "Iphone 17 Pro", price: 1400, img: "iphone17pro.jpg"},

    {id: 5, name: "Samsung Galaxy S20 Ultra", price: 230, img: "s20ultra.jpg"},
    {id: 6, name: "Samsung Galaxy S21 Ultra", price: 250, img: "s21ultra.jpg"},
    {id: 7, name: "Samsung Galaxy S22 Ultra", price: 500, img: "s22ultra.jpg"},
    {id: 8, name: "Samsung Galaxy S23 Ultra", price: 750, img: "s23ultra.jpg"},
    {id: 9, name: "Samsung Galaxy S24 Ultra", price: 1000, img: "s24ultra.jpg"},
    {id: 10, name: "Samsung Galaxy S25 Ultra", price: 1500, img: "s25ultra.jpg"},

    {id: 11, name: "Wireless Headset", price: 200, img: "headset.jpg"},
    {id: 12, name: "Earpod", price: 80, img: "earpod.jpg"},

    {id: 13, name: "Macbook Pro", price: 1500, img: "macbookpro.jpg"},
    {id: 14, name: "Samsung Galaxy Book", price: 1200, img: "samsung.jpg"},
    {id: 15, name: "HP Elitebook", price: 1100, img: "hp.jpg"},
    {id: 16, name: "Lenovo Thinkpad", price: 1300, img: "lenovo.jpg"}
];

// Get elements safely
const productContainer = document.getElementById("product1");
const cartItem = document.getElementById("cart-item");
const cartCount = document.getElementById("cart-count");
const cartTotal = document.getElementById("cart-total");
const paystackBtn = document.getElementById("paystack-btn");
const bankTransferBtn = document.getElementById("bank-transfer-btn");
const bankModal = document.getElementById("bank-modal");
const closeModal = document.querySelector(".close");
const copyDetailsBtn = document.getElementById("copy-details-btn");
const confirmBankPaymentBtn = document.getElementById("confirm-bank-payment");

// Bank Account Details
const BANK_DETAILS = {
    bankName: "OPAY",
    accountNumber: "8067080261",
    accountName: "NOTOMA DAVID GODSFAVOUR"
};

// Load cart from localStorage or initialize empty
let cart = JSON.parse(localStorage.getItem("cart")) || [];

// Save cart to localStorage
function saveCart() {
    localStorage.setItem("cart", JSON.stringify(cart));
}

// Load and display cart on page load
function loadCart() {
    updateCart();
}

// Auth helpers
function renderAuthLinks() {
    const authContainer = document.getElementById('auth-links');
    if (!authContainer) return;

    if (isLoggedIn()) {
        const user = getStoredUser();
        const name = user?.fullName || user?.name || 'Customer';
        authContainer.innerHTML = `
            <span class="user-greeting">Hi, ${name}</span>
            <button id="logoutBtn" class="auth-btn">Logout</button>
        `;
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) logoutBtn.addEventListener('click', logout);
    } else {
        authContainer.innerHTML = `
            <a href="login.html" class="auth-btn">Login</a>
            <a href="register.html" class="auth-btn">Sign Up</a>
        `;
    }
}

// Product Modal Variables
const productModal = document.getElementById('productModal');
const modalClose = document.querySelector('.modal-close');
const modalAddToCartBtn = document.getElementById('modalAddToCart');
const quantityInput = document.getElementById('quantityInput');
const decreaseQtyBtn = document.getElementById('decreaseQty');
const increaseQtyBtn = document.getElementById('increaseQty');
let currentViewingProduct = null;

// Modal Control Functions
function openProductModal(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    currentViewingProduct = product;
    const productName = product.title || product.name;
    const productImage = product.image || `./${product.img}`;
    const productPrice = product.price;
    const productCategory = product.category || 'Uncategorized';
    const productDescription = product.description || 'No description available';
    const productRating = product.rating || { rate: 0, count: 0 };

    // Populate modal
    document.getElementById('modalProductTitle').textContent = productName;
    document.getElementById('modalProductImage').src = productImage;
    document.getElementById('modalProductImage').onerror = function() {
        this.src = 'https://via.placeholder.com/400?text=Product';
    };
    
    document.getElementById('modalProductPrice').textContent = `$${productPrice.toFixed(2)}`;
    document.getElementById('modalProductCategory').textContent = productCategory;
    document.getElementById('modalProductDescription').textContent = productDescription;
    
    // Set rating
    const ratingStars = productRating.rate ? String.fromCharCode(0x2B50).repeat(Math.round(productRating.rate)) : 'No rating';
    document.getElementById('modalProductRating').innerHTML = 
        `<span class="stars">${ratingStars}</span> <span>${productRating.rate}/5 (${productRating.count} reviews)</span>`;

    // Reset quantity
    quantityInput.value = 1;
    updateModalSubtotal();

    // Show modal
    productModal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeProductModal() {
    productModal.style.display = 'none';
    document.body.style.overflow = 'auto';
    currentViewingProduct = null;
}

function updateModalSubtotal() {
    if (!currentViewingProduct) return;
    const quantity = parseInt(quantityInput.value) || 1;
    const subtotal = currentViewingProduct.price * quantity;
    document.getElementById('modalSubtotal').textContent = `$${subtotal.toFixed(2)}`;
}

// Modal Event Listeners
if (modalClose) {
    modalClose.onclick = closeProductModal;
}

// Close modal when clicking outside of it
window.onclick = function(event) {
    if (event.target === productModal) {
        closeProductModal();
    }
}

// Quantity buttons
if (decreaseQtyBtn) {
    decreaseQtyBtn.onclick = () => {
        const currentValue = parseInt(quantityInput.value) || 1;
        if (currentValue > 1) {
            quantityInput.value = currentValue - 1;
            updateModalSubtotal();
        }
    };
}

if (increaseQtyBtn) {
    increaseQtyBtn.onclick = () => {
        const currentValue = parseInt(quantityInput.value) || 1;
        quantityInput.value = currentValue + 1;
        updateModalSubtotal();
    };
}

// Quantity input change listener
if (quantityInput) {
    quantityInput.addEventListener('change', updateModalSubtotal);
}

// Modal Add to Cart
if (modalAddToCartBtn) {
    modalAddToCartBtn.onclick = () => {
        if (!currentViewingProduct) return;
        const quantity = parseInt(quantityInput.value) || 1;
        addToCart(currentViewingProduct.id, quantity);
        
        // Show feedback
        const originalText = modalAddToCartBtn.textContent;
        modalAddToCartBtn.textContent = '✓ Added to Cart!';
        modalAddToCartBtn.style.backgroundColor = '#10b981';
        
        setTimeout(() => {
            modalAddToCartBtn.textContent = originalText;
            modalAddToCartBtn.style.backgroundColor = '';
            closeProductModal();
        }, 1500);
    };
}

// Render products
function displayProducts() {
    currentCategory = 'All';
    if (!productContainer) return; // Only run on index.html
    productContainer.innerHTML = "";

    products.forEach(product => {
        // Handle both backend products (with 'title', 'image') and local products (with 'name', 'img')
        const productName = product.title || product.name;
        const productImage = product.image || `./${product.img}`;
        const productPrice = product.price;
        const productId = product.id;
        const productCategory = product.category || 'Uncategorized';
        const productDescription = product.description || '';
        const productRating = product.rating || { rate: 0, count: 0 };

        const div = document.createElement("div");
        div.className = "product";

        // Add category class for styling
        const categoryClass = productCategory.toLowerCase().replace(/[^a-z0-9]/g, '-');
        div.classList.add(`category-${categoryClass}`);
        
        const ratingStars = productRating.rate ? String.fromCharCode(0x2B50).repeat(Math.round(productRating.rate)) : 'No rating';

        div.innerHTML = `
            <img src="${productImage}" alt="${productName}" onerror="this.src='https://via.placeholder.com/200?text=Product'">
            <h3>${productName}</h3>
            <span class="product-category">${getCategoryIcon(productCategory)} ${productCategory}</span>
            <div class="product-rating">
                <span class="stars">${ratingStars}</span>
                <span>(${productRating.count})</span>
            </div>
            <div class="product-price">$${productPrice.toFixed(2)}</div>
            <div class="product-actions">
                <button class="view-btn" onclick="event.stopPropagation()">\uD83D\uDD0D\uFE0F View</button>
                <button class="cart-btn" onclick="event.stopPropagation()">\uD83D\uDED2 Add</button>
            </div>
        `;

        div.style.cursor = 'pointer';
        div.onclick = () => openProductModal(productId);
        
        div.querySelector(".view-btn").onclick = (e) => {
            e.stopPropagation();
            openProductModal(productId);
        };
        
        div.querySelector(".cart-btn").onclick = (e) => {
            e.stopPropagation();
            addToCartDirect(productId, 1);
        };

        productContainer.appendChild(div);
    });
}

// Only display products on pages that have the product container
if (productContainer) {
    displayProducts();
    updateActiveCategoryIndicator('All');
}

function updateCart() {
    // Update cart count on all pages
    if (cartCount) {
        cartCount.textContent = cart.length;
    }
    // Update cart items and total on cart.html
    // Update cart items list only on cart.html page
    if (cartItem) {
        cartItem.innerHTML = "";
        let total = 0;
        
        // Group items by product ID to show quantities
        const cartGrouped = {};
        cart.forEach((item) => {
            if (!cartGrouped[item.id]) {
                cartGrouped[item.id] = {
                    name: item.name,
                    price: item.price,
                    image: item.image,
                    quantity: 0
                };
            }
            cartGrouped[item.id].quantity += 1;
        });

        let itemIndex = 0;
        Object.keys(cartGrouped).forEach((productId) => {
            const grouped = cartGrouped[productId];
            const subtotal = grouped.price * grouped.quantity;
            total += subtotal;

            const li = document.createElement("li");
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';
            
            li.innerHTML = `
                <div style="flex: 1;">
                    <strong>${grouped.name}</strong> 
                    <span style="color: var(--text-light); font-size: 0.9rem;">× ${grouped.quantity}</span>
                </div>
                <div style="display: flex; gap: 1rem; align-items: center;">
                    <strong>$${subtotal.toFixed(2)}</strong>
                    <button>❌</button>
                </div>
            `;
            
            li.querySelector("button").onclick = () => {
                // Remove all items with this product ID
                const indexesToRemove = [];
                cart.forEach((item, idx) => {
                    if (item.id == productId) {
                        indexesToRemove.push(idx);
                    }
                });
                // Remove from highest index to lowest to avoid index shifting
                indexesToRemove.sort((a, b) => b - a);
                indexesToRemove.forEach(idx => cart.splice(idx, 1));
                updateCart();
                saveCart();
            };
            
            cartItem.appendChild(li);
        });

        if (cartTotal) {
            cartTotal.textContent = `Total: $${total.toFixed(2)}`;
        }

        // If the user isn't logged in, disable checkout buttons and show a prompt
        const authNotice = document.getElementById('auth-notice');
        if (authNotice) {
            if (!isLoggedIn()) {
                authNotice.textContent = 'Please login to checkout. Use the Login/Sign Up links above.';
                if (paystackBtn) paystackBtn.disabled = true;
                if (bankTransferBtn) bankTransferBtn.disabled = true;
            } else {
                authNotice.textContent = '';
                if (paystackBtn) paystackBtn.disabled = false;
                if (bankTransferBtn) bankTransferBtn.disabled = false;
            }
        }
    }
}

// Cart logic
function addToCart(id, quantity = 1) {
    if (!requireLogin('You must be logged in to add items to your cart.')) return;

    const item = products.find(p => p.id === id);
    if (!item) {
        console.log('Product not found');
        return;
    }
    
    // Normalize the item to have consistent properties
    const normalizedItem = {
        id: item.id,
        name: item.title || item.name,
        price: item.price,
        image: item.image || item.img,
        quantity: quantity
    };
    
    // Add multiple items if quantity > 1
    for (let i = 0; i < quantity; i++) {
        cart.push({
            id: normalizedItem.id,
            name: normalizedItem.name,
            price: normalizedItem.price,
            image: normalizedItem.image
        });
    }
    
    // Monitor cart addition
    console.log(`✅ Added ${quantity}x to cart: ${normalizedItem.name} - $${normalizedItem.price}`);
    console.log(`📊 Total items in cart: ${cart.length}`);
    
    updateCart();
    saveCart();
}

// Direct add to cart (quick add from product list)
function addToCartDirect(id, quantity = 1) {
    if (!requireLogin('You must be logged in to add items to your cart.')) return;

    addToCart(id, quantity);
    
    // Show feedback on the button
    const productElement = document.querySelector(`[onclick*="addToCartDirect(${id}"]`);
    if (productElement) {
        const originalText = productElement.textContent;
        productElement.textContent = '✓ Added!';
        productElement.style.backgroundColor = '#10b981';
        productElement.style.color = 'white';
        
        setTimeout(() => {
            productElement.textContent = originalText;
            productElement.style.backgroundColor = '';
            productElement.style.color = '';
        }, 1500);
    }
}
    

function removeFromCart(index) {
    const removedItem = cart[index];
    cart.splice(index, 1);
    console.log(`\uD83D\uDDD1\uFE0F Removed: ${removedItem.name}`);
    updateCart();
    saveCart();
}

// Paystack Configuration
const PAYSTACK_PUBLIC_KEY = "pk_test_02eb90c04af32807e2fa4bf4d557f0695b94bf9d";
const PAYSTACK_CURRENCY = "NGN";

// Cart Monitoring Function
function monitorCart() {
    console.log("\uD83D\uDCE6 Current Cart Status:");
    console.log(`Items in cart: ${cart.length}`);
    let totalAmount = 0;
    
    cart.forEach((item, index) => {
        console.log(`${index + 1}. ${item.name} - $${item.price}`);
        totalAmount += item.price;
    });
    
    console.log(`Total Amount: $${totalAmount}`);
    return totalAmount;
}

// Initialize Paystack Script
function initPaystack() {
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    document.head.appendChild(script);
}

// Paystack Payment Handler
function initiatePaystackPayment(email, amount) {
    if (typeof PaystackPop !== 'undefined') {
        const handler = PaystackPop.setup({
            key: PAYSTACK_PUBLIC_KEY,
            email: email,
            amount: amount * 100, // Paystack uses kobo (cents) - multiply by 100
            currency: PAYSTACK_CURRENCY,
            onClose: function() {
                alert('Payment window closed.');
            },
            onSuccess: function(response) {
                console.log('✅ Payment successful! Reference: ' + response.reference);
                alert('Thank you for your purchase! Reference: ' + response.reference);
                
                // Log successful transaction
                const transactionLog = {
                    reference: response.reference,
                    amount: amount,
                    currency: PAYSTACK_CURRENCY,
                    itemsCount: cart.length,
                    timestamp: new Date().toLocaleString(),
                    items: cart,
                    paymentType: 'Paystack',
                    status: 'success'
                };
                
                // Send to backend for persistent storage
                sendTransactionToServer(transactionLog);

                // Store transaction in localStorage (optional duplicate)
                let transactions = JSON.parse(localStorage.getItem("transactions")) || [];
                transactions.push(transactionLog);
                localStorage.setItem("transactions", JSON.stringify(transactions));
                
                // Clear cart after successful payment
                cart = [];
                updateCart();
                saveCart();
            }
        });
        handler.openIframe();
    } else {
        alert('Paystack script not loaded. Please refresh the page and try again.');
    }
}

// Checkout with Paystack
if (paystackBtn) {
    paystackBtn.addEventListener("click", () => {
        if (!requireLogin('You must be logged in to make a payment.')) return;

        if (cart.length === 0) {
            alert("Your cart is empty!");
            return;
        }
        
        // Monitor the cart before checkout
        const totalAmount = monitorCart();
        
        // Prompt for email
        const email = prompt("Please enter your email address for payment:");
        
        if (!email) {
            alert("Email is required to proceed with payment.");
            return;
        }
        
        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            alert("Please enter a valid email address.");
            return;
        }
        
        console.log(`\uD83D\uDED2 Checkout initiated for ${cart.length} item(s)`);
        console.log(`💰 Total Amount: $${totalAmount}`);
        console.log(`\uD83D\uDCE7 Customer Email: ${email}`);
        
        // Initiate Paystack payment
        initiatePaystackPayment(email, totalAmount);
    });
}

// Bank Transfer Payment Handler
if (bankTransferBtn) {
    bankTransferBtn.addEventListener("click", () => {
        if (cart.length === 0) {
            alert("Your cart is empty!");
            return;
        }
        
        // Monitor the cart before showing bank details
        const totalAmount = monitorCart();
        
        // Update bank amount in modal
        document.getElementById("bank-amount").textContent = `$${totalAmount}`;
        
        // Show bank transfer modal
        bankModal.style.display = "block";
        
        console.log(`🏦 Bank Transfer initiated for ${cart.length} item(s)`);
        console.log(`💰 Total Amount: $${totalAmount}`);
        console.log(`📊 Bank Details: ${BANK_DETAILS.bankName} - ${BANK_DETAILS.accountNumber}`);
    });
}

// Close modal when X is clicked
if (closeModal) {
    closeModal.addEventListener("click", () => {
        bankModal.style.display = "none";
    });
}

// Close modal when clicking outside
window.addEventListener("click", (event) => {
    if (event.target === bankModal) {
        bankModal.style.display = "none";
    }
});

// Copy bank details to clipboard
if (copyDetailsBtn) {
    copyDetailsBtn.addEventListener("click", () => {
        const accountDetails = `Bank: ${BANK_DETAILS.bankName}
Account Number: ${BANK_DETAILS.accountNumber}
Account Name: ${BANK_DETAILS.accountName}`;
        
        navigator.clipboard.writeText(accountDetails).then(() => {
            alert("✓ Account details copied to clipboard!");
            copyDetailsBtn.textContent = "✓ Copied!";
            setTimeout(() => {
                copyDetailsBtn.textContent = "📋 Copy Account Details";
            }, 2000);
        }).catch(() => {
            alert("Failed to copy. Please copy manually.");
        });
    });
}

// Confirm bank payment
if (confirmBankPaymentBtn) {
    confirmBankPaymentBtn.addEventListener("click", () => {
        if (!requireLogin('You must be logged in to confirm a bank transfer.')) return;

        const totalAmount = cart.reduce((sum, item) => sum + item.price, 0);
        
        // Log bank transfer transaction
        const transactionLog = {
            reference: `BANK-${Date.now()}`,
            amount: totalAmount,
            currency: PAYSTACK_CURRENCY,
            itemsCount: cart.length,
            timestamp: new Date().toLocaleString(),
            items: cart,
            paymentType: 'Bank Transfer',
            status: "pending"
        };
        
        // send to backend
        sendTransactionToServer(transactionLog);
        
        // Store transaction in localStorage
        let transactions = JSON.parse(localStorage.getItem("transactions")) || [];
        transactions.push(transactionLog);
        localStorage.setItem("transactions", JSON.stringify(transactions));
        
        console.log("✅ Bank transfer recorded:", transactionLog);
        
        alert(`✓ Thank you for your payment! 
        
We received your confirmation. Your order will be processed once we verify your bank transfer.

Bank Details Used:
${BANK_DETAILS.bankName}
Account: ${BANK_DETAILS.accountNumber}
Name: ${BANK_DETAILS.accountName}
Amount: $${totalAmount}

Please allow 24-48 hours for verification. You will receive a confirmation email.`);
        
        // Close modal
        bankModal.style.display = "none";
        
        // Clear cart after bank transfer order
        cart = [];
        updateCart();
        saveCart();
    });
}

// helper to POST transactions to backend
function sendTransactionToServer(log) {
    const token = getAuthToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    fetch('http://localhost:4000/api/v1/transactions', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(log)
    })
    .then(res => res.json())
    .then(data => console.log('Server stored transaction', data))
    .catch(err => console.error('Error storing transaction', err));
}

// Initialize Paystack on page load
initPaystack();

// Load cart on page load
loadCart();

// Render login/sign-up links in the header
renderAuthLinks();

// Protect cart icon link
const cartIconLink = document.querySelector('#cart-icon a');
if (cartIconLink) {
    cartIconLink.addEventListener('click', (e) => {
        if (!isLoggedIn()) {
            e.preventDefault();
            localStorage.setItem('redirectAfterLogin', 'cart.html');
            window.location.href = 'login.html';
        }
    });
}

// Search
function searchProduct(){
    const query = document.getElementById("search").value.toLowerCase();
    if (!productContainer) return;
    productContainer.innerHTML = "";
    
    const filteredProducts = products.filter(product => {
        const productName = (product.title || product.name || "").toLowerCase();
        const productDesc = (product.description || "").toLowerCase();
        return productName.includes(query) || productDesc.includes(query);
    });
    
    if (filteredProducts.length === 0) {
        productContainer.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; padding: 40px;">No products found matching "${query}"</p>`;
        return;
    }
    
    filteredProducts.forEach((product) => {
        const productName = product.title || product.name;
        const productImage = product.image || `./${product.img}`;
        const productPrice = product.price;
        const productCategory = product.category || 'Uncategorized';
        const productRating = product.rating || { rate: 0, count: 0 };
        
        const div = document.createElement("div");
        div.className = "product";
        
        const ratingStars = productRating.rate ? String.fromCharCode(0x2B50).repeat(Math.round(productRating.rate)) : 'No rating';
        
        div.innerHTML = `
            <img src="${productImage}" alt="${productName}" onerror="this.src='https://via.placeholder.com/200?text=Product'">
            <h3>${productName}</h3>
            <span class="product-category">${productCategory}</span>
            <div class="product-rating">
                <span class="stars">${ratingStars}</span>
                <span>(${productRating.count})</span>
            </div>
            <div class="product-price">$${productPrice.toFixed(2)}</div>
            <div class="product-actions">
                <button class="view-btn" onclick="event.stopPropagation()">\uD83D\uDD0D\uFE0F View</button>
                <button class="cart-btn" onclick="event.stopPropagation()">\uD83D\uDED2 Add</button>
            </div>
        `;
        
        div.style.cursor = 'pointer';
        div.onclick = () => openProductModal(product.id);
        
        div.querySelector(".view-btn").onclick = (e) => {
            e.stopPropagation();
            openProductModal(product.id);
        };
        
        div.querySelector(".cart-btn").onclick = (e) => {
            e.stopPropagation();
            addToCartDirect(product.id, 1);
        };
        
        productContainer.appendChild(div);
    }); 
}

// Slider functionality
let slideIndex = 1;
let slideTimer;

function showSlide(n) {
    const slides = document.querySelectorAll(".slide");
    const dots = document.querySelectorAll(".dot");

    if (n > slides.length) {
        slideIndex = 1;
    }
    if (n < 1) {
        slideIndex = slides.length;
    }

    slides.forEach(slide => {
        slide.style.display = "none";
    });
    dots.forEach(dot => {
        dot.classList.remove("active");
    });

    if (slides[slideIndex - 1]) {
        slides[slideIndex - 1].style.display = "block";
    }
    if (dots[slideIndex - 1]) {
        dots[slideIndex - 1].classList.add("active");
    }
}

function changeSlide(n) {
    clearTimeout(slideTimer);
    showSlide(slideIndex += n);
    autoSlide();
}

function currentSlide(n) {
    clearTimeout(slideTimer);
    showSlide(slideIndex = n);
    autoSlide();
}

function autoSlide() {
    slideTimer = setTimeout(() => {
        slideIndex++;
        showSlide(slideIndex);
        autoSlide();
    }, 4000); // Change slide every 4 seconds
}

// Initialize slider
showSlide(slideIndex);
autoSlide();

// Hero Slider functionality
let heroSlideIndex = 1;
let heroSlideTimer;

function showHeroSlide(n) {
    const slides = document.querySelectorAll(".hero-slide");
    const dots = document.querySelectorAll(".hero-dot");

    if (n > slides.length) {
        heroSlideIndex = 1;
    }
    if (n < 1) {
        heroSlideIndex = slides.length;
    }

    slides.forEach(slide => {
        slide.classList.remove("active");
    });
    dots.forEach(dot => {
        dot.classList.remove("active");
    });

    if (slides[heroSlideIndex - 1]) {
        slides[heroSlideIndex - 1].classList.add("active");
    }
    if (dots[heroSlideIndex - 1]) {
        dots[heroSlideIndex - 1].classList.add("active");
    }
}

function changeHeroSlide(n) {
    clearTimeout(heroSlideTimer);
    showHeroSlide(heroSlideIndex += n);
    autoHeroSlide();
}

function currentHeroSlide(n) {
    clearTimeout(heroSlideTimer);
    showHeroSlide(heroSlideIndex = n);
    autoHeroSlide();
}

function autoHeroSlide() {
    heroSlideTimer = setTimeout(() => {
        heroSlideIndex++;
        showHeroSlide(heroSlideIndex);
        autoHeroSlide();
    }, 5000); // Change hero slide every 5 seconds
}

// Initialize hero slider
showHeroSlide(heroSlideIndex);
autoHeroSlide();

// Category filter function
function filterByCategory(category) {
    console.log('Filtering by category:', category);
    console.log('Total products available:', products.length);
    currentCategory = category;
    
    if (!productContainer) return;
    productContainer.innerHTML = "";
    
    const backendMap = {
        'Electronics': 'electronics',
        'Men\'s Clothing': 'men\'s clothing',
        'Women\'s Clothing': 'women\'s clothing',
        'Jewelry': 'jewelery',
        'Books': 'books',
        'Home & Garden': 'home',
        'Sports': 'sports'
    };
    const fallbackMap = {
        'Electronics': ['Iphone', 'Samsung', 'Wireless', 'Earpod'],
        'Clothing': [],
        'Books': [],
        'Home & Garden': [],
        'Sports': []
    };

    const filteredProducts = products.filter(product => {
        if (product.category) {
            // backend item
            const target = backendMap[category];
            if (target) {
                const matches = (product.category || "").toLowerCase().includes(target.toLowerCase());
                if (matches) console.log('Backend product matched:', product.title || product.name, 'category:', product.category);
                return matches;
            }
            return false;
        } else {
            // fallback item
            const keywords = fallbackMap[category] || [];
            const name = (product.title || product.name || "").toLowerCase();
            const matches = keywords.some(k => name.includes(k.toLowerCase()));
            if (matches) console.log('Fallback product matched:', product.title || product.name);
            return matches;
        }
    });

    console.log('Filtered products count:', filteredProducts.length);
    
    // Update active category indicator
    updateActiveCategoryIndicator(category);

    if (filteredProducts.length === 0) {
        productContainer.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; padding: 40px;">No products found in this category</p>`;
        return;
    }

    filteredProducts.forEach((product) => {
        const productName = product.title || product.name;
        const productImage = product.image || `./${product.img}`;
        const productPrice = product.price;
        const productCategory = product.category || 'Uncategorized';
        const productRating = product.rating || { rate: 0, count: 0 };
        
        const div = document.createElement("div");
        div.className = "product";
        
        // Add category class for styling
        const categoryClass = productCategory.toLowerCase().replace(/[^a-z0-9]/g, '-');
        div.classList.add(`category-${categoryClass}`);
        
        const ratingStars = productRating.rate ? String.fromCharCode(0x2B50).repeat(Math.round(productRating.rate)) : 'No rating';
        
        div.innerHTML = `
            <img src="${productImage}" alt="${productName}" onerror="this.src='https://via.placeholder.com/200?text=Product'">
            <h3>${productName}</h3>
            <span class="product-category">${getCategoryIcon(productCategory)} ${productCategory}</span>
            <div class="product-rating">
                <span class="stars">${ratingStars}</span>
                <span>(${productRating.count})</span>
            </div>
            <div class="product-price">$${productPrice.toFixed(2)}</div>
            <div class="product-actions">
                <button class="view-btn" onclick="event.stopPropagation()">\uD83D\uDD0D\uFE0F View</button>
                <button class="cart-btn" onclick="event.stopPropagation()">\uD83D\uDED2 Add</button>
            </div>
        `;
        
        div.style.cursor = 'pointer';
        div.onclick = () => openProductModal(product.id);
        
        div.querySelector(".view-btn").onclick = (e) => {
            e.stopPropagation();
            openProductModal(product.id);
        };
        
        div.querySelector(".cart-btn").onclick = (e) => {
            e.stopPropagation();
            addToCartDirect(product.id, 1);
        };
        
        productContainer.appendChild(div);
    });
}

// Contact Form Functionality
const contactForm = document.getElementById("contactForm");
if (contactForm) {
    contactForm.addEventListener("submit", function(e) {
        e.preventDefault();
        
        // Get form values
        const fullName = document.getElementById("fullName").value.trim();
        const email = document.getElementById("email").value.trim();
        const phone = document.getElementById("phone").value.trim();
        const subject = document.getElementById("subject").value;
        const message = document.getElementById("message").value.trim();
        const agree = document.getElementById("agree").checked;
        const formMessage = document.getElementById("formMessage");

        // Validation
        if (!fullName || !email || !subject || !message || !agree) {
            formMessage.textContent = "Please fill in all required fields and agree to the privacy policy.";
            formMessage.className = "form-message error";
            return;
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            formMessage.textContent = "Please enter a valid email address.";
            formMessage.className = "form-message error";
            return;
        }

        // Prepare form data
        const formData = {
            fullName: fullName,
            email: email,
            phone: phone,
            subject: subject,
            message: message,
            timestamp: new Date().toLocaleString()
        };

        // Store message in localStorage
        let messages = JSON.parse(localStorage.getItem("contactMessages")) || [];
        messages.push(formData);
        localStorage.setItem("contactMessages", JSON.stringify(messages));

        // Show success message
        formMessage.textContent = "✓ Your message has been sent successfully! We'll get back to you soon.";
        formMessage.className = "form-message success";

        // Reset form
        contactForm.reset();

        // Clear message after 5 seconds
        setTimeout(() => {
            formMessage.className = "form-message";
            formMessage.textContent = "";
        }, 5000);

        console.log("Message sent:", formData);
    });
}

// Fetch products from backend on page load - AFTER all functions are defined
fetch('http://localhost:4000/api/v1/products')
.then(res => res.json())
.then(data => {
    console.log('Products fetched:', data);
    products = [...data, ...fallbackProducts];
    if (productContainer) {
        displayProducts();
    }
})
.catch((err) => {
    console.log('Error fetching products:', err);
    // Fallback to local products if backend fails
    products = [...fallbackProducts];
    if (productContainer) {
        displayProducts();
    }
})
