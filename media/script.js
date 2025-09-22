// Global state
let timerState = {
    isRunning: false,
    isPaused: false,
    timeRemaining: 25 * 60, // 25 minutes in seconds
    totalTime: 25 * 60,
    mode: 'focus', // 'focus', 'shortBreak', 'longBreak'
    completedPomodoros: 0
};

let settings = {
    focusTime: 25,
    shortBreak: 5,
    longBreak: 15,
    notifications: true
};

let tasks = [];

// VS Code API
const vscode = acquireVsCodeApi();

// DOM Elements
const timerDisplay = document.getElementById('timerDisplay');
const timerLabel = document.getElementById('timerLabel');
const progressRing = document.querySelector('.progress-ring-circle');
const timerCircle = document.querySelector('.timer-circle');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const shortBreakBtn = document.getElementById('shortBreakBtn');
const longBreakBtn = document.getElementById('longBreakBtn');
const focusBtn = document.getElementById('focusBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsSection = document.getElementById('settingsSection');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const addTaskBtn = document.getElementById('addTaskBtn');
const pendingTasksList = document.getElementById('pendingTasksList');
const completedTasksList = document.getElementById('completedTasksList');
const completedCount = document.getElementById('completedCount');

// Settings elements
const focusTimeValue = document.getElementById('focusTimeValue');
const shortBreakValue = document.getElementById('shortBreakValue');
const longBreakValue = document.getElementById('longBreakValue');
const notificationsToggle = document.getElementById('notificationsToggle');

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    setupProgressRing();
    updateTimerDisplay();
    updateModeButtons();
    updateSettings();
    requestInitialData();
});

// Event Listeners
function setupEventListeners() {
    // Timer controls
    startBtn.addEventListener('click', startTimer);
    pauseBtn.addEventListener('click', pauseTimer);
    stopBtn.addEventListener('click', stopTimer);
    
    // Timer mode buttons
    shortBreakBtn.addEventListener('click', () => setTimerMode('shortBreak'));
    longBreakBtn.addEventListener('click', () => setTimerMode('longBreak'));
    focusBtn.addEventListener('click', () => setTimerMode('focus'));
    
    // Settings
    settingsBtn.addEventListener('click', toggleSettings);
    closeSettingsBtn.addEventListener('click', closeSettings);
    
    // Settings tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', switchTab);
    });
    
    // Settings value buttons
    document.querySelectorAll('.value-btn').forEach(btn => {
        btn.addEventListener('click', adjustSetting);
    });
    
    // Notifications toggle
    notificationsToggle.addEventListener('change', updateNotificationsSetting);
    
    // Tasks
    addTaskBtn.addEventListener('click', addTask);
}

// Timer Functions
function startTimer() {
    console.log('Starting timer... Current state:', timerState);
    
    // No actualizar el estado visual aquí, dejar que venga del backend
    vscode.postMessage({
        command: 'startPomodoro'
    });
}

function pauseTimer() {
    vscode.postMessage({
        command: 'pausePomodoro'
    });
}

function stopTimer() {
    vscode.postMessage({
        command: 'stopPomodoro'
    });
}

function setTimerMode(mode) {
    if (timerState.isRunning) {
        if (!confirm('Changing mode will stop the current timer. Continue?')) {
            return;
        }
        stopTimer();
    }
    
    // Update mode and time based on settings
    timerState.mode = mode;
    switch(mode) {
        case 'focus':
            timerState.timeRemaining = settings.focusTime * 60;
            timerState.totalTime = settings.focusTime * 60;
            break;
        case 'shortBreak':
            timerState.timeRemaining = settings.shortBreak * 60;
            timerState.totalTime = settings.shortBreak * 60;
            break;
        case 'longBreak':
            timerState.timeRemaining = settings.longBreak * 60;
            timerState.totalTime = settings.longBreak * 60;
            break;
    }
    
    updateTimerDisplay();
    updateProgressRing();
    updateModeButtons();
}

function updateModeButtons() {
    // Remove active class from all mode buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Add active class to current mode button
    const currentModeBtn = document.getElementById(timerState.mode === 'focus' ? 'focusBtn' : 
                                                  timerState.mode === 'shortBreak' ? 'shortBreakBtn' : 'longBreakBtn');
    if (currentModeBtn) {
        currentModeBtn.classList.add('active');
    }
}

function updateTimerState(newState) {
    // Actualizar el estado con los nuevos valores
    Object.assign(timerState, newState);
    
    console.log('Timer state updated:', timerState);
    
    updateTimerDisplay();
    updateModeButtons();
    updateControls();
    updateProgressRing();
}

function updateTimerDisplay() {
    const minutes = Math.floor(timerState.timeRemaining / 60);
    const seconds = timerState.timeRemaining % 60;
    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Update label based on mode
    switch(timerState.mode) {
        case 'focus':
            timerLabel.textContent = 'FOCUS';
            break;
        case 'shortBreak':
            timerLabel.textContent = 'SHORT BREAK';
            break;
        case 'longBreak':
            timerLabel.textContent = 'LONG BREAK';
            break;
    }
}

function updateControls() {
    console.log('Updating controls with state:', timerState);
    
    // Limpiar clases de animación
    timerCircle.classList.remove('running');
    
    if (timerState.isRunning && !timerState.isPaused) {
        console.log('Setting to running state');
        // Timer está corriendo
        startBtn.style.display = 'none';
        pauseBtn.style.display = 'inline-block';
        stopBtn.style.display = 'inline-block';
        timerCircle.classList.add('running');
        
        // Hacer el botón START primary para destacar cuando esté pausado
        startBtn.classList.remove('primary');
        pauseBtn.classList.add('primary');
        
    } else if (timerState.isPaused) {
        console.log('Setting to paused state');
        // Timer está pausado
        startBtn.style.display = 'inline-block';
        startBtn.textContent = 'RESUME';
        pauseBtn.style.display = 'none';
        stopBtn.style.display = 'inline-block';
        
        startBtn.classList.add('primary');
        
    } else {
        console.log('Setting to idle state');
        // Timer detenido/idle
        startBtn.style.display = 'inline-block';
        startBtn.textContent = 'START';
        pauseBtn.style.display = 'none';
        stopBtn.style.display = 'none';
        
        startBtn.classList.add('primary');
    }
}

// Progress Ring
function setupProgressRing() {
    const radius = 90;
    const circumference = 2 * Math.PI * radius;
    progressRing.style.strokeDasharray = circumference;
    progressRing.style.strokeDashoffset = 0;
}

function updateProgressRing() {
    const radius = 90;
    const circumference = 2 * Math.PI * radius;
    const progress = (timerState.totalTime - timerState.timeRemaining) / timerState.totalTime;
    const offset = circumference - (progress * circumference);
    
    progressRing.style.strokeDashoffset = offset;
    
    // Change color based on mode
    if (timerState.mode === 'focus') {
        progressRing.classList.remove('break');
    } else {
        progressRing.classList.add('break');
    }
}

// Settings Functions
function toggleSettings() {
    const isVisible = settingsSection.style.display !== 'none';
    settingsSection.style.display = isVisible ? 'none' : 'block';
}

function closeSettings() {
    settingsSection.style.display = 'none';
}

function switchTab(event) {
    const targetTab = event.target.getAttribute('data-tab');
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${targetTab}-tab`).classList.add('active');
}

function adjustSetting(event) {
    const action = event.target.getAttribute('data-action');
    const setting = event.target.getAttribute('data-setting');
    
    let currentValue = settings[setting];
    
    if (action === 'increase') {
        currentValue = Math.min(currentValue + 1, 60); // Max 60 minutes
    } else if (action === 'decrease') {
        currentValue = Math.max(currentValue - 1, 1); // Min 1 minute
    }
    
    settings[setting] = currentValue;
    updateSettings();
    sendSettingsUpdate();
}

function updateNotificationsSetting() {
    settings.notifications = notificationsToggle.checked;
    sendSettingsUpdate();
}

function updateSettings() {
    focusTimeValue.textContent = settings.focusTime.toString().padStart(2, '0');
    shortBreakValue.textContent = settings.shortBreak.toString().padStart(2, '0');
    longBreakValue.textContent = settings.longBreak.toString().padStart(2, '0');
    notificationsToggle.checked = settings.notifications;
}

function sendSettingsUpdate() {
    vscode.postMessage({
        command: 'updateSettings',
        settings: {
            focusTime: settings.focusTime,
            shortBreak: settings.shortBreak,
            longBreak: settings.longBreak,
            notifications: settings.notifications
        }
    });
}

// Tasks Functions
function addTask() {
    // Crear un prompt personalizado usando un input temporal
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    `;
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: #2a2a2a;
        padding: 20px;
        border-radius: 10px;
        border: 1px solid #444;
        min-width: 300px;
    `;
    
    modal.innerHTML = `
        <h3 style="margin: 0 0 15px 0; color: white;">Add New Task</h3>
        <input type="text" id="taskNameInput" placeholder="Enter task name..." 
               style="width: 100%; padding: 10px; border: 1px solid #555; background: #333; color: white; border-radius: 5px; margin-bottom: 15px;">
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
            <button id="cancelBtn" style="padding: 8px 16px; background: #666; color: white; border: none; border-radius: 5px; cursor: pointer;">Cancel</button>
            <button id="confirmBtn" style="padding: 8px 16px; background: #ff6b47; color: white; border: none; border-radius: 5px; cursor: pointer;">Add Task</button>
        </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    const input = modal.querySelector('#taskNameInput');
    const cancelBtn = modal.querySelector('#cancelBtn');
    const confirmBtn = modal.querySelector('#confirmBtn');
    
    input.focus();
    
    function closeModal() {
        document.body.removeChild(overlay);
    }
    
    function addTaskAction() {
        const taskName = input.value.trim();
        if (taskName) {
            vscode.postMessage({
                command: 'addTask',
                taskName: taskName
            });
            closeModal();
        }
    }
    
    cancelBtn.addEventListener('click', closeModal);
    confirmBtn.addEventListener('click', addTaskAction);
    
    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addTaskAction();
        } else if (e.key === 'Escape') {
            closeModal();
        }
    });
    
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            closeModal();
        }
    });
}

function updateTasksList(newTasks) {
    tasks = newTasks;
    renderTasks();
}

function renderTasks() {
    // Separar tareas pendientes y completadas
    const pendingTasks = tasks.filter(task => !task.isCompleted);
    const completedTasks = tasks.filter(task => task.isCompleted);
    
    // Renderizar tareas pendientes
    pendingTasksList.innerHTML = '';
    if (pendingTasks.length === 0) {
        pendingTasksList.innerHTML = '<div class="no-tasks">No pending tasks. Add one!</div>';
    } else {
        pendingTasks.forEach(task => {
            const taskElement = createTaskElement(task, false);
            pendingTasksList.appendChild(taskElement);
        });
    }
    
    // Renderizar tareas completadas
    completedTasksList.innerHTML = '';
    completedCount.textContent = completedTasks.length;
    if (completedTasks.length === 0) {
        completedTasksList.innerHTML = '<div class="no-tasks">No completed tasks yet.</div>';
    } else {
        completedTasks.forEach(task => {
            const taskElement = createTaskElement(task, true);
            completedTasksList.appendChild(taskElement);
        });
    }
}

function createTaskElement(task, isCompleted = false) {
    const taskDiv = document.createElement('div');
    taskDiv.className = isCompleted ? 'task-item completed' : 'task-item';
    
    const completed = task.completedPomodoros || 0;
    
    const actions = isCompleted ? 
        // Para tareas completadas: play, regresar a pendientes, eliminar
        `<button class="task-action-btn" onclick="startTaskPomodoro('${task.id}')">▶️</button>
         <button class="task-action-btn uncomplete-btn" onclick="uncompleteTask('${task.id}')">↩️</button>
         <button class="task-action-btn delete-btn" onclick="deleteCompletedTask('${task.id}')">🗑️</button>` :
        // Para tareas pendientes: play y completar
        `<button class="task-action-btn" onclick="startTaskPomodoro('${task.id}')">▶️</button>
         <button class="task-action-btn complete-btn" onclick="completeTask('${task.id}')">✅</button>`;
    
    taskDiv.innerHTML = `
        <div class="task-info">
            <div class="task-name">${task.name}</div>
            <div class="task-progress">${completed} pomodoros completed</div>
        </div>
        <div class="task-actions">
            ${actions}
        </div>
    `;
    
    return taskDiv;
}

function startTaskPomodoro(taskId) {
    vscode.postMessage({
        command: 'startPomodoro',
        taskId: taskId
    });
}

function completeTask(taskId) {
    vscode.postMessage({
        command: 'completeTask',
        taskId: taskId
    });
}

function uncompleteTask(taskId) {
    vscode.postMessage({
        command: 'uncompleteTask',
        taskId: taskId
    });
}

function deleteCompletedTask(taskId) {
    if (confirm('¿Estás seguro de que quieres eliminar esta tarea completada?')) {
        vscode.postMessage({
            command: 'deleteCompletedTask',
            taskId: taskId
        });
    }
}

// Communication with VS Code
function requestInitialData() {
    vscode.postMessage({
        command: 'getTasks'
    });
}

// Listen for messages from the extension
window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.command) {
        case 'initialData':
            settings = { ...settings, ...message.settings };
            updateSettings();
            if (message.timerState) {
                updateTimerState(message.timerState);
            }
            break;
            
        case 'timerUpdate':
            const data = message.data;
            console.log('Received timer update:', data);
            
            updateTimerState({
                isRunning: data.state === 'running',
                isPaused: data.state === 'paused',
                timeRemaining: data.remainingTime,
                totalTime: data.remainingTime + (timerState.totalTime - timerState.timeRemaining), // Mantener el total original
                mode: data.sessionType === 'work' ? 'focus' : 
                      data.sessionType === 'shortBreak' ? 'shortBreak' : 'longBreak',
                completedPomodoros: data.completedPomodoros || 0
            });
            break;
            
        case 'tasksUpdate':
            updateTasksList(message.tasks);
            break;
    }
});

// Utility Functions
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Keyboard shortcuts
document.addEventListener('keydown', function(event) {
    if (event.code === 'Space' && !event.target.matches('input, textarea')) {
        event.preventDefault();
        if (timerState.isRunning && !timerState.isPaused) {
            pauseTimer();
        } else {
            startTimer();
        }
    }
});