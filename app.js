// DOM Elements
const todoForm = document.getElementById('todoForm');
const todoInput = document.getElementById('todoInput');
const todoList = document.getElementById('todoList');
const themeToggle = document.getElementById('themeToggle');
const moonIcon = themeToggle.querySelector('.moon');
const sunIcon = themeToggle.querySelector('.sun');
const toast = document.getElementById('toast');
const pinModal = document.getElementById('pinModal');
const pinInputs = [...document.querySelectorAll('.pin-input')];
const pinError = document.getElementById('pinError');
const clearCompletedBtn = document.getElementById('clearCompleted');

// State
let todos = [];
let verifiedPin = null;

// PIN Management
async function checkPinRequired() {
    try {
        const response = await fetch('/api/pin-required');
        const { required, length } = await response.json();
        if (required) {
            if (!verifiedPin) {
                await setupPinInputs(length);
                showPinModal();
            }
        } else {
            loadTodos();
        }
    } catch (error) {
        showToast('Failed to check PIN requirement');
    }
}

async function setupPinInputs(length) {
    const container = document.querySelector('.pin-input-container');
    container.innerHTML = ''; // Clear existing inputs
    
    // Create new inputs based on PIN length
    for (let i = 0; i < length; i++) {
        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = 1;
        input.pattern = '[0-9]';
        input.inputMode = 'numeric';
        input.className = 'pin-input';
        input.setAttribute('aria-label', `PIN digit ${i + 1}`);
        container.appendChild(input);
    }
    
    // Update pinInputs array with new elements
    pinInputs.length = 0;
    pinInputs.push(...document.querySelectorAll('.pin-input'));
    
    // Set up event listeners for new inputs
    setupPinInputListeners();
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

        // Only allow numbers
        input.addEventListener('keypress', (e) => {
            if (!/[0-9]/.test(e.key)) {
                e.preventDefault();
            }
        });
    });
}

function showPinModal() {
    pinModal.setAttribute('aria-hidden', 'false');
    pinInputs[0].focus();
    todoForm.style.display = 'none';
}

function hidePinModal() {
    pinModal.setAttribute('aria-hidden', 'true');
    todoForm.style.display = 'flex';
    clearPin();
}

function clearPin() {
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
        const { valid } = await response.json();
        if (valid) {
            verifiedPin = pin;
            hidePinModal();
            loadTodos();
        } else {
            pinError.setAttribute('aria-hidden', 'false');
            clearPin();
        }
    } catch (error) {
        showToast('Failed to verify PIN');
        clearPin();
    }
}

// Enhanced fetch with PIN
async function fetchWithPin(url, options = {}) {
    if (verifiedPin) {
        options.headers = {
            ...options.headers,
            'X-Pin': verifiedPin
        };
    }
    return fetch(url, options);
}

// Theme Management
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
const currentTheme = localStorage.getItem('theme');

function updateThemeIcons(isDark) {
    moonIcon.style.display = isDark ? 'none' : 'block';
    sunIcon.style.display = isDark ? 'block' : 'none';
}

if (currentTheme === 'dark' || (!currentTheme && prefersDark.matches)) {
    document.documentElement.setAttribute('data-theme', 'dark');
    updateThemeIcons(true);
} else {
    updateThemeIcons(false);
}

themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
    updateThemeIcons(!isDark);
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
});

// Toast Notification
function showToast(message, duration = 3000) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), duration);
}

// Todo Management
async function loadTodos() {
    try {
        const response = await fetchWithPin('/api/todos');
        if (!response.ok) throw new Error('Failed to load todos');
        todos = await response.json();
        renderTodos();
    } catch (error) {
        showToast('Failed to load todos');
        console.error(error);
    }
}

async function saveTodos() {
    try {
        const response = await fetchWithPin('/api/todos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(todos)
        });
        if (!response.ok) throw new Error('Failed to save todos');
    } catch (error) {
        showToast('Failed to save todos');
        console.error(error);
    }
}

function createTodoElement(todo) {
    const li = document.createElement('li');
    li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
    li.innerHTML = `
        <input type="checkbox" ${todo.completed ? 'checked' : ''}>
        <span>${todo.text}</span>
        <button class="delete-btn" aria-label="Delete todo">×</button>
    `;

    const checkbox = li.querySelector('input');
    checkbox.addEventListener('change', () => {
        todo.completed = checkbox.checked;
        renderTodos();
        saveTodos();
        showToast(todo.completed ? 'Task completed! 🎉' : 'Task uncompleted');
    });

    const deleteBtn = li.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', () => {
        li.remove();
        todos = todos.filter(t => t !== todo);
        saveTodos();
        showToast('Task deleted');
    });

    return li;
}

function renderTodos() {
    todoList.innerHTML = '';
    
    // Separate todos into active and completed
    const activeTodos = todos.filter(todo => !todo.completed);
    const completedTodos = todos.filter(todo => todo.completed);
    
    // Render active todos
    activeTodos.forEach(todo => {
        todoList.appendChild(createTodoElement(todo));
    });
    
    // Add divider if there are both active and completed todos
    if (activeTodos.length > 0 && completedTodos.length > 0) {
        const divider = document.createElement('li');
        divider.className = 'todo-divider';
        divider.textContent = 'Completed';
        todoList.appendChild(divider);
    }
    
    // Render completed todos
    completedTodos.forEach(todo => {
        todoList.appendChild(createTodoElement(todo));
    });
}

// Event Listeners
todoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = todoInput.value.trim();
    
    if (text) {
        const todo = { text, completed: false };
        todos.push(todo);
        renderTodos();
        saveTodos();
        todoInput.value = '';
        showToast('Task added');
    }
});

// Clear completed tasks
clearCompletedBtn.addEventListener('click', () => {
    const completedCount = todos.filter(todo => todo.completed).length;
    
    if (completedCount === 0) {
        showToast('No completed tasks to clear');
        return;
    }
    
    if (confirm(`Are you sure you want to delete ${completedCount} completed task${completedCount === 1 ? '' : 's'}?`)) {
        todos = todos.filter(todo => !todo.completed);
        renderTodos();
        saveTodos();
        showToast(`Cleared ${completedCount} completed task${completedCount === 1 ? '' : 's'}`);
    }
});

// Initialize
checkPinRequired(); 