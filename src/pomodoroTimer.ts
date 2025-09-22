import * as vscode from 'vscode';
import { Task, TimerState, TimerStatus, PomodoroSession } from './types';

export class PomodoroTimer {
    private timer?: NodeJS.Timeout;
    private status: TimerStatus = {
        state: TimerState.Idle,
        remainingTime: 0,
        sessionType: 'work',
        completedPomodoros: 0
    };
    private sessions: PomodoroSession[] = [];
    private statusBarItem: vscode.StatusBarItem;

    private _onTimerUpdate = new vscode.EventEmitter<TimerStatus>();
    public readonly onTimerUpdate = this._onTimerUpdate.event;

    private _onPomodoroComplete = new vscode.EventEmitter<Task>();
    public readonly onPomodoroComplete = this._onPomodoroComplete.event;

    constructor(private context: vscode.ExtensionContext) {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        this.statusBarItem.command = 'pomodoroTasks.showTimer';
        this.updateStatusBar();
        this.statusBarItem.show();
        
        this.loadSessions();
    }

    startPomodoro(task: Task): void {
        if (this.status.state === TimerState.Running) {
            vscode.window.showWarningMessage('Ya hay un pomodoro en ejecución');
            return;
        }

        const config = vscode.workspace.getConfiguration('pomodoroTasks');
        const workDuration = config.get<number>('workDuration', 25);
        
        this.status = {
            state: TimerState.Running,
            currentTask: task,
            remainingTime: workDuration * 60, // convertir a segundos
            sessionType: 'work',
            completedPomodoros: this.status.completedPomodoros
        };

        this.startTimer();
        vscode.window.showInformationMessage(`Pomodoro iniciado para: ${task.name}`);
    }

    pausePomodoro(): void {
        if (this.status.state === TimerState.Running) {
            this.status.state = TimerState.Paused;
            this.stopTimer();
            vscode.window.showInformationMessage('Pomodoro pausado');
            this.updateStatusBar();
            this._onTimerUpdate.fire(this.status);
        }
    }

    resumePomodoro(): void {
        if (this.status.state === TimerState.Paused) {
            this.status.state = TimerState.Running;
            this.startTimer();
            vscode.window.showInformationMessage('Pomodoro reanudado');
        }
    }

    stopPomodoro(): void {
        this.stopTimer();
        this.status = {
            state: TimerState.Idle,
            remainingTime: 0,
            sessionType: 'work',
            completedPomodoros: this.status.completedPomodoros
        };
        this.updateStatusBar();
        this._onTimerUpdate.fire(this.status);
        vscode.window.showInformationMessage('Pomodoro detenido');
    }

    private startTimer(): void {
        this.timer = setInterval(() => {
            this.status.remainingTime--;
            this.updateStatusBar();
            
            if (this.status.remainingTime <= 0) {
                this.onTimerFinished();
            }
            
            this._onTimerUpdate.fire(this.status);
        }, 1000);
    }

    private stopTimer(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
    }

    private onTimerFinished(): void {
        this.stopTimer();
        
        const config = vscode.workspace.getConfiguration('pomodoroTasks');
        const notifications = config.get<boolean>('notifications', true);
        
        if (this.status.sessionType === 'work') {
            // Completar pomodoro de trabajo
            this.status.completedPomodoros++;
            
            if (this.status.currentTask) {
                this._onPomodoroComplete.fire(this.status.currentTask);
                
                // Registrar la sesión
                const session: PomodoroSession = {
                    taskId: this.status.currentTask.id,
                    startTime: new Date(Date.now() - (25 * 60 * 1000)), // tiempo estimado
                    endTime: new Date(),
                    duration: 25,
                    type: 'work',
                    completed: true
                };
                this.sessions.push(session);
                this.saveSessions();
            }
            
            if (notifications) {
                vscode.window.showInformationMessage(
                    `¡Pomodoro completado! 🍅 Tiempo para un descanso.`,
                    'Iniciar Descanso',
                    'Detener'
                ).then(selection => {
                    if (selection === 'Iniciar Descanso') {
                        this.startBreak();
                    } else {
                        this.stopPomodoro();
                    }
                });
            } else {
                this.startBreak();
            }
        } else {
            // Descanso terminado
            if (notifications) {
                vscode.window.showInformationMessage(
                    `¡Descanso terminado! ⏰ ¿Listo para el siguiente pomodoro?`,
                    'Continuar',
                    'Detener'
                ).then(selection => {
                    if (selection === 'Continuar') {
                        if (this.status.currentTask) {
                            this.startPomodoro(this.status.currentTask);
                        }
                    } else {
                        this.stopPomodoro();
                    }
                });
            } else {
                this.stopPomodoro();
            }
        }
    }

    private startBreak(): void {
        const config = vscode.workspace.getConfiguration('pomodoroTasks');
        const longBreakInterval = config.get<number>('longBreakInterval', 4);
        const shortBreakDuration = config.get<number>('shortBreakDuration', 5);
        const longBreakDuration = config.get<number>('longBreakDuration', 15);
        
        const isLongBreak = this.status.completedPomodoros % longBreakInterval === 0;
        const breakDuration = isLongBreak ? longBreakDuration : shortBreakDuration;
        
        this.status = {
            ...this.status,
            state: TimerState.Running,
            remainingTime: breakDuration * 60,
            sessionType: isLongBreak ? 'longBreak' : 'shortBreak'
        };
        
        this.startTimer();
        
        const breakType = isLongBreak ? 'descanso largo' : 'descanso corto';
        vscode.window.showInformationMessage(`${breakType} iniciado (${breakDuration} min)`);
    }

    private updateStatusBar(): void {
        if (this.status.state === TimerState.Idle) {
            this.statusBarItem.text = '🍅 Pomodoro';
            this.statusBarItem.tooltip = 'Haz clic para ver el temporizador';
        } else {
            const minutes = Math.floor(this.status.remainingTime / 60);
            const seconds = this.status.remainingTime % 60;
            const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            const icon = this.status.sessionType === 'work' ? '🍅' : 
                        this.status.sessionType === 'shortBreak' ? '☕' : '🛋️';
            
            const statusIcon = this.status.state === TimerState.Paused ? '⏸️' : '';
            
            this.statusBarItem.text = `${icon} ${timeString} ${statusIcon}`;
            this.statusBarItem.tooltip = this.getTooltip();
        }
    }

    private getTooltip(): string {
        if (this.status.state === TimerState.Idle) {
            return 'No hay pomodoro activo';
        }
        
        const taskName = this.status.currentTask?.name || 'Sin tarea';
        const sessionType = this.status.sessionType === 'work' ? 'Trabajo' :
                          this.status.sessionType === 'shortBreak' ? 'Descanso corto' : 'Descanso largo';
        const state = this.status.state === TimerState.Paused ? '(Pausado)' : '';
        
        return `${sessionType}: ${taskName} ${state}\nPomodoros completados: ${this.status.completedPomodoros}`;
    }

    getStatus(): TimerStatus {
        return { ...this.status };
    }

    private saveSessions(): void {
        this.context.globalState.update('pomodoroSessions', this.sessions);
    }

    private loadSessions(): void {
        const savedSessions = this.context.globalState.get<PomodoroSession[]>('pomodoroSessions', []);
        this.sessions = savedSessions.map((session: any) => ({
            ...session,
            startTime: new Date(session.startTime),
            endTime: session.endTime ? new Date(session.endTime) : undefined
        }));
    }

    getSessions(): PomodoroSession[] {
        return [...this.sessions];
    }

    dispose(): void {
        this.stopTimer();
        this.statusBarItem.dispose();
    }
}