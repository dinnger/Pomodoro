import * as vscode from 'vscode';
import { Task } from './types';
import { TaskProvider } from './taskProvider';
import { BookmarkService } from './bookmarkService';

function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export class TaskService {
    private webviewProvider?: any; // Referencia al webview provider

    constructor(
        private taskProvider: TaskProvider
    ) {}

    setWebviewProvider(webviewProvider: any): void {
        this.webviewProvider = webviewProvider;
    }

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

    /**
     * Elimina todas las tareas que son bookmarks
     */
    deleteAllBookmarks(): void {
        const tasks = this.getAllTasks();
        const bookmarks = tasks.filter(task => task.isBookmark);
        
        bookmarks.forEach(bookmark => {
            this.taskProvider.deleteTask(bookmark.id);
        });
        
        console.log(`Eliminados ${bookmarks.length} bookmarks`);
    }

    /**
     * Escanea el workspace en busca de comentarios TODO/FIXME y los convierte en tareas
     */
    async scanAndCreateBookmarks(): Promise<void> {
        try {
            let bookmarkComments: any[] = [];

            // Mostrar progreso
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Escaneando comentarios TODO/FIXME...",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: "Iniciando escaneo..." });

                // Eliminar bookmarks existentes
                this.deleteAllBookmarks();
                progress.report({ increment: 30, message: "Limpiando bookmarks anteriores..." });

                // Actualizar el webview si está disponible
                if (this.webviewProvider) this.webviewProvider.updateTasks();
            

                // Buscar nuevos comentarios
                bookmarkComments = await BookmarkService.findBookmarkComments();
                progress.report({ increment: 60, message: `Encontrados ${bookmarkComments.length} comentarios...` });

                // Crear tareas desde los comentarios
                bookmarkComments.forEach(comment => {
                    const task = BookmarkService.createTaskFromBookmark(comment);
                    this.taskProvider.addTask(task);
                });

                progress.report({ increment: 100, message: "Completado" });
            });

            if (bookmarkComments.length > 0) {
                vscode.window.showInformationMessage(
                    `Se encontraron ${bookmarkComments.length} comentarios TODO/FIXME y se agregaron como tareas`
                );
            } else {
                vscode.window.showInformationMessage('No se encontraron comentarios TODO/FIXME en el workspace');
            }

            // Actualizar el webview si está disponible
            if (this.webviewProvider) this.webviewProvider.updateTasks();
            

        } catch (error) {
            console.error('Error escaneando bookmarks:', error);
            vscode.window.showErrorMessage('Error al escanear comentarios TODO/FIXME');
        }
    }

    /**
     * Abre la ubicación de un bookmark en el editor
     */
    async openBookmarkLocation(task: Task): Promise<void> {
        if (!task.isBookmark) {
            vscode.window.showWarningMessage('Esta tarea no es un bookmark');
            return;
        }

        await BookmarkService.openBookmarkLocation(task);
    }
}