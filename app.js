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
const deleteListBtn = document.getElementById('deleteList');
const addListBtn = document.getElementById('addList');

// Set up list selector event handlers once
const selectorContainer = listSelector.parentElement;

// Show/hide custom select on click
function handleSelectorClick(e) {
    e.preventDefault();
    e.stopPropagation();
    const customSelect = selectorContainer.querySelector('.custom-select');
    if (customSelect) {
        const isHidden = customSelect.style.display === 'none' || !customSelect.style.display;
        customSelect.style.display = isHidden ? 'block' : 'none';
    }
}

// Hide custom select when clicking outside
function handleOutsideClick(e) {
    const customSelect = selectorContainer.querySelector('.custom-select');
    if (customSelect && !selectorContainer.contains(e.target)) {
        customSelect.style.display = 'none';
    }
}

// Handle keyboard navigation
function handleKeyboard(e) {
    const customSelect = selectorContainer.querySelector('.custom-select');
    if (customSelect) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            customSelect.style.display = customSelect.style.display === 'none' ? 'block' : 'none';
        } else if (e.key === 'Escape') {
            customSelect.style.display = 'none';
        }
    }
}

// Initialize dropdown event listeners after data is loaded
function initializeDropdown() {
    listSelector.addEventListener('mousedown', handleSelectorClick);
    document.addEventListener('click', handleOutsideClick);
    listSelector.addEventListener('keydown', handleKeyboard);
}

// State
let todos = {};
let currentList = 'List 1';

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
    // Sort the list keys to ensure List 1 comes first
    const sortedKeys = Object.keys(todos).sort((a, b) => {
        if (a === 'List 1') return -1;
        if (b === 'List 1') return 1;
        return a.localeCompare(b);
    });
    
    // Update the native select
    listSelector.innerHTML = sortedKeys.map(listId => 
        `<option value="${listId}">${listId}</option>`
    ).join('');
    listSelector.value = currentList;
    
    // Create a custom select
    const customSelect = document.createElement('div');
    customSelect.className = 'custom-select';
    customSelect.style.display = 'none'; // Explicitly set initial state
    
    sortedKeys.forEach(listId => {
        const item = document.createElement('div');
        item.className = `list-item ${listId === 'List 1' ? 'list-1' : ''}`;
        item.dataset.value = listId;
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = listId;
        item.appendChild(nameSpan);
        
        if (listId !== 'List 1') {
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'delete-btn';
            deleteBtn.setAttribute('aria-label', `Delete ${listId}`);
            deleteBtn.innerHTML = `
                <svg viewBox="0 0 24 24">
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            `;
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteList(listId);
            });
            item.appendChild(deleteBtn);
        }
        
        item.addEventListener('click', () => {
            if (listId !== currentList) {
                switchList(listId);
                customSelect.style.display = 'none';
            }
        });
        
        customSelect.appendChild(item);
    });
    
    // Replace the existing custom select if any
    const existingCustomSelect = selectorContainer.querySelector('.custom-select');
    if (existingCustomSelect) {
        const wasVisible = existingCustomSelect.style.display === 'block';
        selectorContainer.removeChild(existingCustomSelect);
        if (wasVisible) {
            customSelect.style.display = 'block';
        }
    }
    selectorContainer.appendChild(customSelect);
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

async function deleteList(listId) {
    // Don't allow deleting the last list or List 1
    if (Object.keys(todos).length <= 1 || listId === 'List 1') {
        showToast('Cannot delete this list');
        return;
    }

    if (confirm(`Are you sure you want to delete "${listId}" and all its tasks?`)) {
        const oldTodos = { ...todos };
        try {
            // Remove the list
            delete todos[listId];
            
            // If we're deleting the current list, switch to another one
            if (listId === currentList) {
                currentList = Object.keys(todos)[0];
            }
            
            // Update UI
            updateListSelector();
            renderTodos();
            
            // Save changes
            await saveTodos();
            showToast('List deleted');
        } catch (error) {
            // Revert changes on failure
            todos = oldTodos;
            updateListSelector();
            renderTodos();
            showToast('Failed to delete list');
        }
    }
}

// Event Listeners for List Management
listSelector.addEventListener('change', (e) => {
    switchList(e.target.value);
});

renameListBtn.addEventListener('click', renameCurrentList);
addListBtn.addEventListener('click', addNewList);

// Enhanced fetch with auth headers
async function fetchWithAuth(url, options = {}) {
    return fetch(url, options);
}

// Theme Management
function updateThemeIcons() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    moonIcon.style.display = isDark ? 'none' : 'block';
    sunIcon.style.display = isDark ? 'block' : 'none';
}

// Initialize theme icons once DOM is loaded
document.addEventListener('DOMContentLoaded', updateThemeIcons);

themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcons();
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
        const response = await fetchWithAuth('/api/todos');
        if (!response.ok) throw new Error('Failed to load todos');
        const data = await response.json();
        initializeLists(data);
        initializeDropdown(); // Initialize dropdown after data is loaded
    } catch (error) {
        showToast('Failed to load todos');
        console.error(error);
    }
}

async function saveTodos() {
    try {
        const response = await fetchWithAuth('/api/todos', {
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
loadTodos(); 