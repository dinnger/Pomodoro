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
const settingsBtn = document.getElementById('settingsBtn');
const settingsSection = document.getElementById('settingsSection');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const addTaskBtn = document.getElementById('addTaskBtn');
const tasksList = document.getElementById('tasksList');

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
    updateSettings();
    requestInitialData();
});

// Event Listeners
function setupEventListeners() {
    // Timer controls
    startBtn.addEventListener('click', startTimer);
    pauseBtn.addEventListener('click', pauseTimer);
    stopBtn.addEventListener('click', stopTimer);
    
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

function updateTimerState(newState) {
    timerState = { ...timerState, ...newState };
    updateTimerDisplay();
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
    if (timerState.isRunning && !timerState.isPaused) {
        startBtn.style.display = 'none';
        pauseBtn.style.display = 'inline-block';
        stopBtn.style.display = 'inline-block';
        timerCircle.classList.add('running');
    } else if (timerState.isPaused) {
        startBtn.style.display = 'inline-block';
        startBtn.textContent = 'RESUME';
        pauseBtn.style.display = 'none';
        stopBtn.style.display = 'inline-block';
        timerCircle.classList.remove('running');
    } else {
        startBtn.style.display = 'inline-block';
        startBtn.textContent = 'START';
        pauseBtn.style.display = 'none';
        stopBtn.style.display = 'none';
        timerCircle.classList.remove('running');
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
    const taskName = prompt('Enter task name:');
    if (taskName && taskName.trim()) {
        vscode.postMessage({
            command: 'addTask',
            task: {
                title: taskName.trim(),
                description: ''
            }
        });
    }
}

function updateTasksList(newTasks) {
    tasks = newTasks;
    renderTasks();
}

function renderTasks() {
    tasksList.innerHTML = '';
    
    if (tasks.length === 0) {
        tasksList.innerHTML = '<div style="text-align: center; color: #888; padding: 20px;">No tasks yet. Add one!</div>';
        return;
    }
    
    tasks.forEach(task => {
        const taskElement = createTaskElement(task);
        tasksList.appendChild(taskElement);
    });
}

function createTaskElement(task) {
    const taskDiv = document.createElement('div');
    taskDiv.className = 'task-item';
    
    const completed = task.completedPomodoros || 0;
    const estimated = task.estimatedPomodoros || 1;
    const percentage = Math.round((completed / estimated) * 100);
    
    taskDiv.innerHTML = `
        <div class="task-info">
            <div class="task-name">${task.name}</div>
            <div class="task-progress">${completed}/${estimated} pomodoros (${percentage}%)</div>
        </div>
        <div class="task-actions">
            <button class="task-action-btn" onclick="startTaskPomodoro('${task.id}')">▶️</button>
            <button class="task-action-btn" onclick="completeTask('${task.id}')">✅</button>
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
            updateTimerState({
                isRunning: message.data.state === 'Running',
                isPaused: message.data.state === 'Paused',
                timeRemaining: message.data.remainingTime,
                mode: message.data.sessionType === 'work' ? 'focus' : 
                      message.data.sessionType === 'shortBreak' ? 'shortBreak' : 'longBreak',
                completedPomodoros: message.data.completedPomodoros
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