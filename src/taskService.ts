import * as vscode from 'vscode';
import { Task } from './types';
import { TaskProvider } from './taskProvider';

function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export class TaskService {
    constructor(
        private taskProvider: TaskProvider
    ) {}

    getAllTasks(): Task[] {
        return this.taskProvider.getAllTasks();
    }

    completeTask(taskId: string): void {
        const tasks = this.getAllTasks();
        const task = tasks.find(t => t.id === taskId);
        
        if (!task) {
            vscode.window.showErrorMessage('Tarea no encontrada');
            return;
        }

        this.taskProvider.updateTask(task.id, {
            isCompleted: true,
            completedAt: new Date()
        });

        vscode.window.showInformationMessage(`Tarea "${task.name}" marcada como completada`);
    }

    createTaskFromName(taskName: string): void {
        this.taskProvider.addTask({
            id: generateId(),
            name: taskName,
            description: '',
            isCompleted: false,
            completedPomodoros: 0,
            estimatedPomodoros: 1,
            createdAt: new Date(),
            completedAt: undefined
        });
    }

    async createTask(): Promise<void> {
        const name = await vscode.window.showInputBox({
            prompt: 'Nombre de la tarea',
            placeHolder: 'Ingresa el nombre de la nueva tarea'
        });

        if (!name) {
            return;
        }

        const description = await vscode.window.showInputBox({
            prompt: 'Descripción de la tarea (opcional)',
            placeHolder: 'Describe la tarea brevemente'
        });

        const task: Task = {
            id: generateId(),
            name: name,
            description: description || '',
            isCompleted: false,
            completedPomodoros: 0,
            estimatedPomodoros: 1, // Valor por defecto, no se muestra
            createdAt: new Date(),
            completedAt: undefined
        };

        this.taskProvider.addTask(task);
    }

    async editTask(task: Task): Promise<void> {
        const name = await vscode.window.showInputBox({
            prompt: 'Nombre de la tarea',
            value: task.name
        });

        if (!name) {
            return;
        }

        const description = await vscode.window.showInputBox({
            prompt: 'Descripción de la tarea (opcional)',
            value: task.description || ''
        });

        const estimatedInput = await vscode.window.showInputBox({
            prompt: 'Número estimado de pomodoros',
            value: task.estimatedPomodoros.toString(),
            validateInput: (value) => {
                const num = parseInt(value);
                if (isNaN(num) || num <= 0) {
                    return 'Debe ser un número positivo';
                }
                return undefined;
            }
        });

        if (!estimatedInput) {
            return;
        }

        const estimatedPomodoros = parseInt(estimatedInput);

        this.taskProvider.updateTask(task.id, {
            name,
            description,
            estimatedPomodoros
        });

        vscode.window.showInformationMessage(`Tarea "${name}" actualizada exitosamente`);
    }

    async deleteTask(task: Task): Promise<void> {
        const response = await vscode.window.showWarningMessage(
            `¿Estás seguro de que quieres eliminar la tarea "${task.name}"?`,
            'Sí',
            'No'
        );

        if (response === 'Sí') {
            this.taskProvider.deleteTask(task.id);
            vscode.window.showInformationMessage(`Tarea "${task.name}" eliminada`);
        }
    }

    incrementPomodoroCount(taskId: string): void {
        const task = this.taskProvider.getTask(taskId);
        if (task) {
            this.taskProvider.updateTask(taskId, {
                completedPomodoros: task.completedPomodoros + 1
            });
        }
    }

    uncompleteTask(taskId: string): void {
        const task = this.taskProvider.getTask(taskId);
        if (task) {
            this.taskProvider.updateTask(taskId, {
                isCompleted: false,
                completedAt: undefined
            });
            vscode.window.showInformationMessage(`Tarea "${task.name}" regresada a pendientes`);
        }
    }

    deleteCompletedTask(taskId: string): void {
        console.log('deleteCompletedTask called with taskId:', taskId);
        const task = this.taskProvider.getTask(taskId);
        console.log('Found task:', task);
        
        if (task) {
            console.log('Deleting task:', task.name);
            this.taskProvider.deleteTask(taskId);
            vscode.window.showInformationMessage(`Tarea "${task.name}" eliminada`);
        } else {
            console.log('Task not found for deletion');
            vscode.window.showErrorMessage('Tarea no encontrada para eliminar');
        }
    }
}