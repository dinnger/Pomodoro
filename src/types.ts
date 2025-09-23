export interface Task {
    id: string;
    name: string;
    description?: string;
    estimatedPomodoros: number;
    completedPomodoros: number;
    isCompleted: boolean;
    createdAt: Date;
    completedAt?: Date;
    isBookmark?: boolean;
    filePath?: string;
    lineNumber?: number;
}

export interface PomodoroSession {
    taskId: string;
    startTime: Date;
    endTime?: Date;
    duration: number; // en minutos
    type: 'work' | 'shortBreak' | 'longBreak';
    completed: boolean;
}

export enum TimerState {
    Idle = 'idle',
    Running = 'running',
    Paused = 'paused'
}

export interface TimerStatus {
    state: TimerState;
    currentTask?: Task;
    remainingTime: number; // en segundos
    sessionType: 'work' | 'shortBreak' | 'longBreak';
    completedPomodoros: number;
    playSound?: boolean; // para reproducir sonido de advertencia
}

export interface PomodoroSettings {
    focusTime: number;
    shortBreak: number;
    longBreak: number;
    notifications: boolean;
    silentActions: boolean;
    oneMinuteWarning: boolean;
    customWarningMinutes: string;
}