export interface Task {
    id: string;
    name: string;
    description?: string;
    estimatedPomodoros: number;
    completedPomodoros: number;
    isCompleted: boolean;
    createdAt: Date;
    completedAt?: Date;
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
}