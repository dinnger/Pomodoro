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
                            // Iniciar nuevo pomodoro
                            const availableTasks = this.taskService.getAllTasks();
                            if (availableTasks.length > 0) {
                                this.pomodoroTimer.startPomodoro(availableTasks[0]);
                            } else {
                                vscode.window.showWarningMessage('No hay tareas disponibles');
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
                    case 'addTask':
                        this._addTask(message.taskName);
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
                            </div>
                        </div>
                    </div>

                    <!-- Tasks Section -->
                    <div class="tasks-section">
                        <div class="tasks-header">
                            <h3>Tasks</h3>
                            <button class="add-task-btn" id="addTaskBtn">+</button>
                        </div>
                        <div class="tasks-list" id="tasksList">
                            <!-- Tasks will be populated here -->
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
            this._view.webview.postMessage({
                command: 'initialData',
                settings: {
                    focusTime: config.get('workDuration', 25),
                    shortBreak: config.get('shortBreakDuration', 5),
                    longBreak: config.get('longBreakDuration', 15),
                    notifications: config.get('showNotifications', true)
                },
                timerState: this.pomodoroTimer.getStatus()
            });
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
        config.update('showNotifications', settings.notifications, vscode.ConfigurationTarget.Global);
    }

    private _addTask(taskName: string) {
        if (taskName && taskName.trim()) {
            this.taskService.createTaskFromName(taskName.trim());
            this._sendTasks();
        }
    }

    public updateTasks() {
        this._sendTasks();
    }
}