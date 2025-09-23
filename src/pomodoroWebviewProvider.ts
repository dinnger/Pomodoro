import * as vscode from 'vscode';
import * as path from 'path';
import { PomodoroTimer } from './pomodoroTimer';
import { TaskService } from './taskService';
import { TimerState } from './types';

export class PomodoroWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'pomodoroWebview';
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly pomodoroTimer: PomodoroTimer,
        private readonly taskService: TaskService
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'startPomodoro':
                        // Verificar si hay un pomodoro pausado para reanudar
                        const currentStatus = this.pomodoroTimer.getStatus();
                        if (currentStatus.state === TimerState.Paused) {
                            // Reanudar pomodoro pausado
                            this.pomodoroTimer.resumePomodoro();
                        } else {
                            // Iniciar nuevo pomodoro con la tarea específica
                            if (message.taskId) {
                                // Si se proporciona un taskId específico, usar esa tarea
                                const allTasks = this.taskService.getAllTasks();
                                const selectedTask = allTasks.find(task => task.id === message.taskId && !task.isCompleted);
                                
                                if (selectedTask) {
                                    this.pomodoroTimer.startPomodoro(selectedTask);
                                } else {
                                    vscode.window.showWarningMessage('La tarea seleccionada no está disponible o ya está completada');
                                }
                            } else if (message.sessionType) {
                                // Si se proporciona un tipo de sesión pero no una tarea, iniciar timer sin tarea
                                this.pomodoroTimer.startTimerOnly(message.sessionType);
                            } else {
                                // Si no se proporciona taskId ni sessionType, usar la primera tarea pendiente
                                const allTasks = this.taskService.getAllTasks();
                                const pendingTasks = allTasks.filter(task => !task.isCompleted);
                                
                                if (pendingTasks.length > 0) {
                                    this.pomodoroTimer.startPomodoro(pendingTasks[0]);
                                } else {
                                    vscode.window.showWarningMessage('No hay tareas pendientes disponibles');
                                }
                            }
                        }
                        // Enviar inmediatamente el estado actualizado
                        this._sendTimerUpdate(this.pomodoroTimer.getStatus());
                        break;
                    case 'pausePomodoro':
                        this.pomodoroTimer.pausePomodoro();
                        break;
                    case 'stopPomodoro':
                        this.pomodoroTimer.stopPomodoro();
                        break;
                    case 'updateSettings':
                        this._updateSettings(message.settings);
                        break;
                    case 'getTasks':
                        this._sendTasks();
                        break;
                    case 'getInitialData':
                        this._sendInitialData();
                        this._sendTasks();
                        break;
                    case 'addTask':
                        this._addTask(message.taskName);
                        break;
                    case 'completeTask':
                        this._completeTask(message.taskId);
                        break;
                    case 'uncompleteTask':
                        this._uncompleteTask(message.taskId);
                        break;
                    case 'deleteCompletedTask':
                        this._deleteCompletedTask(message.taskId);
                        break;
                    case 'showNotification':
                        this._showNotification(message.message, message.type);
                        break;
                    case 'selectTask':
                        this._selectTask(message.taskId);
                        break;
                }
            },
            undefined,
            []
        );

        // Send initial data
        this._sendInitialData();

        // Listen to timer updates
        this.pomodoroTimer.onTimerUpdate((data) => {
            this._sendTimerUpdate(data);
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'style.css'));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'script.js'));

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleUri}" rel="stylesheet">
                <title>Pomodoro Timer</title>
            </head>
            <body>
                <div class="container">
                    <!-- Timer Section -->
                    <div class="timer-section">
                        <div class="timer-circle">
                            <svg class="progress-ring" width="200" height="200">
                                <circle class="progress-ring-background" cx="100" cy="100" r="90"></circle>
                                <circle class="progress-ring-circle" cx="100" cy="100" r="90"></circle>
                            </svg>
                            <div class="timer-content">
                                <div class="timer-display" id="timerDisplay">25:00</div>
                                <div class="timer-label" id="timerLabel">FOCUS</div>
                            </div>
                        </div>
                        
                        <div class="controls">
                            <button class="control-btn" id="startBtn">START</button>
                            <button class="control-btn" id="pauseBtn" style="display: none;">PAUSE</button>
                            <button class="control-btn secondary" id="stopBtn" style="display: none;">STOP</button>
                        </div>
                        
                        <div class="timer-modes">
                            <button class="mode-btn" id="shortBreakBtn">Short Break</button>
                            <button class="mode-btn" id="longBreakBtn">Long Break</button>
                            <button class="mode-btn" id="focusBtn">Focus</button>
                        </div>
                    </div>

                    <!-- Settings Section -->
                    <div class="settings-section" id="settingsSection" style="display: none;">
                        <div class="settings-header">
                            <h3>Settings</h3>
                            <button class="close-btn" id="closeSettingsBtn">×</button>
                        </div>
                        <div class="settings-tabs">
                            <button class="tab-btn active" data-tab="duration">DURATION</button>
                            <button class="tab-btn" data-tab="notifications">NOTIFICATIONS</button>
                        </div>
                        <div class="settings-content">
                            <div class="tab-content active" id="duration-tab">
                                <div class="setting-item">
                                    <label>Focus Session</label>
                                    <div class="setting-value">
                                        <button class="value-btn" data-action="decrease" data-setting="focusTime">-</button>
                                        <span id="focusTimeValue">25</span>
                                        <span class="unit">min</span>
                                        <button class="value-btn" data-action="increase" data-setting="focusTime">+</button>
                                    </div>
                                </div>
                                <div class="setting-item">
                                    <label>Short break</label>
                                    <div class="setting-value">
                                        <button class="value-btn" data-action="decrease" data-setting="shortBreak">-</button>
                                        <span id="shortBreakValue">05</span>
                                        <span class="unit">min</span>
                                        <button class="value-btn" data-action="increase" data-setting="shortBreak">+</button>
                                    </div>
                                </div>
                                <div class="setting-item">
                                    <label>Long break</label>
                                    <div class="setting-value">
                                        <button class="value-btn" data-action="decrease" data-setting="longBreak">-</button>
                                        <span id="longBreakValue">15</span>
                                        <span class="unit">min</span>
                                        <button class="value-btn" data-action="increase" data-setting="longBreak">+</button>
                                    </div>
                                </div>
                            </div>
                            <div class="tab-content" id="notifications-tab">
                                <div class="setting-item">
                                    <label>Desktop Notifications</label>
                                    <div class="toggle-switch">
                                        <input type="checkbox" id="notificationsToggle" checked>
                                        <label for="notificationsToggle"></label>
                                    </div>
                                </div>
                                <div class="setting-item">
                                    <div class="setting-info">
                                        <label>Silent Actions</label>
                                        <div class="setting-description">Silenciar notificaciones de crear, editar, eliminar tareas</div>
                                    </div>
                                    <div class="toggle-switch">
                                        <input type="checkbox" id="silentActionsToggle">
                                        <label for="silentActionsToggle"></label>
                                    </div>
                                </div>
                                <div class="setting-item">
                                    <div class="setting-info">
                                        <label>1-Minute Warning Sound</label>
                                        <div class="setting-description">Reproducir sonido cuando falte 1 minuto</div>
                                    </div>
                                    <div class="toggle-switch">
                                        <input type="checkbox" id="oneMinuteWarningToggle" checked>
                                        <label for="oneMinuteWarningToggle"></label>
                                    </div>
                                </div>
                                <div class="setting-item">
                                    <div class="setting-info">
                                        <label>Custom Warning Minutes</label>
                                        <div class="setting-description">Minutos para advertencias separados por coma (ej: 5,3,1)</div>
                                    </div>
                                    <div class="setting-input">
                                        <input type="text" id="customWarningMinutes" placeholder="5,3,1" maxlength="20">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Tasks Section -->
                    <div class="tasks-section">
                        <div class="tasks-header">
                            <h3>Pending Tasks</h3>
                            <button class="add-task-btn" id="addTaskBtn">+</button>
                        </div>
                        <div class="tasks-list" id="pendingTasksList">
                            <!-- Pending tasks will be populated here -->
                        </div>
                    </div>

                    <!-- Completed Tasks Section -->
                    <div class="tasks-section completed-section">
                        <div class="tasks-header">
                            <h3>Completed Tasks</h3>
                            <span class="task-count" id="completedCount">0</span>
                        </div>
                        <div class="tasks-list completed-tasks" id="completedTasksList">
                            <!-- Completed tasks will be populated here -->
                        </div>
                    </div>

                    <!-- Bottom Controls -->
                    <div class="bottom-controls">
                        <button class="icon-btn" id="settingsBtn">⚙️</button>
                    </div>
                </div>

                <script src="${scriptUri}"></script>
            </body>
            </html>`;
    }

    private _sendInitialData() {
        if (this._view) {
            const config = vscode.workspace.getConfiguration('pomodoroTasks');
            const initialData = {
                command: 'initialData',
                settings: {
                    focusTime: config.get('workDuration', 25),
                    shortBreak: config.get('shortBreakDuration', 5),
                    longBreak: config.get('longBreakDuration', 15),
                    notifications: config.get('notifications', true),
                    silentActions: config.get('silentActions', false),
                    oneMinuteWarning: config.get('oneMinuteWarning', true),
                    customWarningMinutes: config.get('customWarningMinutes', '5,3,1')
                },
                timerState: this.pomodoroTimer.getStatus()
            };
            console.log('Sending initial data:', initialData);
            this._view.webview.postMessage(initialData);
        }
    }

    private _sendTimerUpdate(data: any) {
        if (this._view) {
            this._view.webview.postMessage({
                command: 'timerUpdate',
                data: data
            });
        }
    }

    private _sendTasks() {
        if (this._view) {
            const tasks = this.taskService.getAllTasks();
            this._view.webview.postMessage({
                command: 'tasksUpdate',
                tasks: tasks
            });
        }
    }

    private _updateSettings(settings: any) {
        const config = vscode.workspace.getConfiguration('pomodoroTasks');
        config.update('workDuration', settings.focusTime, vscode.ConfigurationTarget.Global);
        config.update('shortBreakDuration', settings.shortBreak, vscode.ConfigurationTarget.Global);
        config.update('longBreakDuration', settings.longBreak, vscode.ConfigurationTarget.Global);
        config.update('notifications', settings.notifications, vscode.ConfigurationTarget.Global);
        config.update('silentActions', settings.silentActions, vscode.ConfigurationTarget.Global);
        config.update('oneMinuteWarning', settings.oneMinuteWarning, vscode.ConfigurationTarget.Global);
        config.update('customWarningMinutes', settings.customWarningMinutes, vscode.ConfigurationTarget.Global);
    }

    private _addTask(taskName: string) {
        if (taskName && taskName.trim()) {
            this.taskService.createTaskFromName(taskName.trim());
            this._sendTasks();
        }
    }

    private _completeTask(taskId: string) {
        // Verificar si la tarea que se está completando es la tarea actualmente corriendo
        const currentTask = this.pomodoroTimer.getCurrentTask();
        if (currentTask && currentTask.id === taskId) {
            // Detener el timer si la tarea activa se está completando
            this.pomodoroTimer.stopPomodoro();
            
            // Enviar actualización del estado del timer
            if (this._view) {
                this._view.webview.postMessage({
                    command: 'timerUpdate',
                    state: this.pomodoroTimer.getStatus()
                });
            }
        }
        
        this.taskService.completeTask(taskId);
        this._sendTasks();
    }

    private _uncompleteTask(taskId: string) {
        this.taskService.uncompleteTask(taskId);
        this._sendTasks();
    }

    private _deleteCompletedTask(taskId: string) {
        console.log('_deleteCompletedTask called with taskId:', taskId);
        this.taskService.deleteCompletedTask(taskId);
        this._sendTasks();
    }

    private _showNotification(message: string, type: string = 'info') {
        switch (type) {
            case 'warning':
                vscode.window.showWarningMessage(message);
                break;
            case 'error':
                vscode.window.showErrorMessage(message);
                break;
            case 'info':
            default:
                vscode.window.showInformationMessage(message);
                break;
        }
    }

    private async _selectTask(taskId: string) {
        const task = this.taskService.getAllTasks().find(t => t.id === taskId);
        
        if (!task) {
            vscode.window.showErrorMessage('Tarea no encontrada');
            return;
        }

        if (task.isBookmark) {
            // Si es un bookmark, abrir el archivo en la línea correspondiente
            await this.taskService.openBookmarkLocation(task);
        } else {
            // Para tareas normales, mostrar información (comportamiento anterior)
            const completedPomodoros = task.completedPomodoros;
            const estimatedPomodoros = task.estimatedPomodoros;
            const progress = Math.round((completedPomodoros / estimatedPomodoros) * 100);
            
            vscode.window.showInformationMessage(
                `${task.name}\nProgreso: ${completedPomodoros}/${estimatedPomodoros} pomodoros (${progress}%)\n${task.description || ''}`,
                'Iniciar Pomodoro',
                'Editar',
                'Eliminar'
            ).then(selection => {
                switch (selection) {
                    case 'Iniciar Pomodoro':
                        this.pomodoroTimer.startPomodoro(task);
                        this._sendTimerUpdate(this.pomodoroTimer.getStatus());
                        break;
                    case 'Editar':
                        this.taskService.editTask(task);
                        break;
                    case 'Eliminar':
                        this.taskService.deleteTask(task);
                        break;
                }
            });
        }
    }

    public updateTasks() {
        this._sendTasks();
    }
}