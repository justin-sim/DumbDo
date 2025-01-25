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
const listSelector = document.getElementById('listSelector');
const renameListBtn = document.getElementById('renameList');
const addListBtn = document.getElementById('addList');

// State
let todos = {};
let currentList = 'List 1';
let verifiedPin = null;

// List Management
function initializeLists(data) {
    if (!data || Object.keys(data).length === 0) {
        // Only create List 1 when there are no lists at all
        todos = { 'List 1': [] };
        currentList = 'List 1';
    } else {
        // Convert only numeric keys, preserve custom names
        const convertedData = {};
        Object.entries(data).forEach(([key, value]) => {
            // Only convert numeric keys
            if (/^\d+$/.test(key)) {
                const newKey = `List ${Object.keys(convertedData).length + 1}`;
                convertedData[newKey] = value;
            } else {
                convertedData[key] = value;
            }
        });
        
        todos = convertedData;
        currentList = Object.keys(convertedData)[0];
    }
    
    updateListSelector();
    renderTodos();
}

function updateListSelector() {
    listSelector.innerHTML = '';
    // Sort the list keys to ensure List 1 comes first
    const sortedKeys = Object.keys(todos).sort((a, b) => {
        if (a === 'List 1') return -1;
        if (b === 'List 1') return 1;
        return a.localeCompare(b);
    });
    
    sortedKeys.forEach(listId => {
        const option = document.createElement('option');
        option.value = listId;
        option.textContent = listId;
        option.selected = listId === currentList;
        listSelector.appendChild(option);
    });
}

function switchList(listId) {
    currentList = listId;
    renderTodos();
}

function addNewList() {
    const listCount = Object.keys(todos).length + 1;
    const newListId = `List ${listCount}`;
    todos[newListId] = [];
    currentList = newListId;
    updateListSelector();
    renderTodos();
    saveTodos();
    showToast('New list added');
}

async function renameCurrentList() {
    const newName = prompt('Enter new list name:', currentList);
    if (newName && newName.trim() && newName !== currentList && !todos[newName]) {
        const oldName = currentList;
        const oldTodos = { ...todos };  // Keep a full backup
        
        try {
            // Update the data structure
            todos[newName] = todos[currentList];
            delete todos[currentList];
            currentList = newName;
            
            // Update UI
            updateListSelector();
            
            // Save changes
            await saveTodos();
            showToast('List renamed');
        } catch (error) {
            // Revert all changes on failure
            todos = oldTodos;
            currentList = oldName;
            updateListSelector();
            showToast('Failed to save list name change');
        }
    }
}

// Event Listeners for List Management
listSelector.addEventListener('change', (e) => {
    switchList(e.target.value);
});

renameListBtn.addEventListener('click', renameCurrentList);
addListBtn.addEventListener('click', addNewList);

// PIN Management
async function checkPinRequired() {
    try {
        const response = await fetch('/api/pin-required');
        const { required, length, locked, lockoutMinutes } = await response.json();
        if (required) {
            if (!verifiedPin) {
                await setupPinInputs(length);
                showPinModal();
                if (locked) {
                    showLockoutError(lockoutMinutes);
                }
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

function showLockoutError(minutes) {
    pinError.textContent = `Too many attempts. Please try again in ${minutes} minutes.`;
    pinError.setAttribute('aria-hidden', 'false');
    pinInputs.forEach(input => {
        input.disabled = true;
    });
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
            verifiedPin = pin;
            hidePinModal();
            loadTodos();
        } else {
            pinError.textContent = data.error;
            pinError.setAttribute('aria-hidden', 'false');
            clearPin();
            
            if (data.locked) {
                showLockoutError(data.lockoutMinutes);
            }
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
        const data = await response.json();
        initializeLists(data);
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
        return true;
    } catch (error) {
        showToast('Failed to save todos');
        console.error(error);
        throw error;  // Re-throw to handle in calling function
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
        todos[currentList] = todos[currentList].filter(t => t !== todo);
        saveTodos();
        showToast('Task deleted');
    });

    return li;
}

function renderTodos() {
    todoList.innerHTML = '';
    const currentTodos = todos[currentList] || [];
    
    // Separate todos into active and completed
    const activeTodos = currentTodos.filter(todo => !todo.completed);
    const completedTodos = currentTodos.filter(todo => todo.completed);
    
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
        todos[currentList].push(todo);
        renderTodos();
        saveTodos();
        todoInput.value = '';
        showToast('Task added');
    }
});

// Clear completed tasks
clearCompletedBtn.addEventListener('click', () => {
    const currentTodos = todos[currentList];
    const completedCount = currentTodos.filter(todo => todo.completed).length;
    
    if (completedCount === 0) {
        showToast('No completed tasks to clear');
        return;
    }
    
    if (confirm(`Are you sure you want to delete ${completedCount} completed task${completedCount === 1 ? '' : 's'}?`)) {
        todos[currentList] = currentTodos.filter(todo => !todo.completed);
        renderTodos();
        saveTodos();
        showToast(`Cleared ${completedCount} completed task${completedCount === 1 ? '' : 's'}`);
    }
});

// Initialize
checkPinRequired(); 