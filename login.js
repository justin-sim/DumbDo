// DOM Elements
const loginForm = document.getElementById('loginForm');
const pinError = document.getElementById('pinError');
const themeToggle = document.getElementById('themeToggle');
const moonIcon = themeToggle.querySelector('.moon');
const sunIcon = themeToggle.querySelector('.sun');
let pinInputs = [];

// Theme Management
function updateThemeIcons() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    moonIcon.style.display = isDark ? 'none' : 'block';
    sunIcon.style.display = isDark ? 'block' : 'none';
}

// Initialize theme icons
updateThemeIcons();

themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcons();
});

// PIN Management
async function setupPinInputs() {
    try {
        const response = await fetch('/api/pin-required');
        const { required, length, locked, lockoutMinutes } = await response.json();
        
        // If no PIN is required, we shouldn't be on this page
        if (!required) {
            window.location.replace('/');
            return;
        }
        
        const container = document.querySelector('.pin-input-container');
        container.innerHTML = '';
        
        // Create PIN inputs
        for (let i = 0; i < length; i++) {
            const input = document.createElement('input');
            input.type = 'text';
            input.maxLength = 1;
            input.pattern = '[0-9]';
            input.inputMode = 'numeric';
            input.className = 'pin-input';
            input.setAttribute('aria-label', `PIN digit ${i + 1}`);
            container.appendChild(input);
            
            if (locked) {
                input.disabled = true;
            }
        }
        
        // Update pinInputs array
        pinInputs = [...document.querySelectorAll('.pin-input')];
        setupPinInputListeners();
        
        if (locked) {
            showError(`Too many attempts. Please try again in ${lockoutMinutes} minutes.`);
        } else {
            pinInputs[0].focus();
        }
    } catch (error) {
        showError('Failed to initialize PIN inputs');
    }
}

function setupPinInputListeners() {
    pinInputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            const value = e.target.value;
            
            // Add/remove the has-value class
            input.classList.toggle('has-value', value !== '');
            
            if (value && index < pinInputs.length - 1) {
                pinInputs[index + 1].focus();
            }
            
            // Check if all inputs are filled
            const pin = pinInputs.map(input => input.value).join('');
            if (pin.length === pinInputs.length) {
                verifyPin(pin);
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                pinInputs[index - 1].focus();
                pinInputs[index - 1].classList.remove('has-value');
            }
        });

        input.addEventListener('keypress', (e) => {
            if (!/[0-9]/.test(e.key)) {
                e.preventDefault();
            }
        });
    });
}

function showError(message) {
    pinError.textContent = message;
    pinError.setAttribute('aria-hidden', 'false');
}

function clearInputs() {
    pinInputs.forEach(input => {
        input.value = '';
        input.classList.remove('has-value');
    });
    pinError.setAttribute('aria-hidden', 'true');
    pinInputs[0].focus();
}

async function verifyPin(pin) {
    try {
        const response = await fetch('/api/verify-pin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ pin })
        });
        
        const data = await response.json();
        
        if (data.valid) {
            // Use replace to prevent back button from returning to login
            window.location.replace('/');
            return;
        }
        
        showError(data.error);
        clearInputs();
        
        if (data.locked) {
            pinInputs.forEach(input => input.disabled = true);
        }
    } catch (error) {
        showError('Failed to verify PIN');
        clearInputs();
    }
}

// Initialize only if we need to be on this page
async function init() {
    try {
        const response = await fetch('/api/pin-required');
        const { required } = await response.json();
        
        if (!required) {
            window.location.replace('/');
            return;
        }
        
        // Only set up PIN inputs if we actually need them
        await setupPinInputs();
    } catch (error) {
        showError('Failed to initialize login');
    }
}

// Start initialization
init(); 