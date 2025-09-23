import * as vscode from 'vscode';
import { Task } from './types';

export class TaskItem extends vscode.TreeItem {
    constructor(
        public readonly task: Task,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(task.name, collapsibleState);
        
        this.tooltip = this.getTooltip();
        this.description = this.getDescription();
        this.iconPath = this.getIcon();
        this.contextValue = this.task.isBookmark ? 'bookmark' : 'task';
        this.command = {
            command: this.task.isBookmark ? 'pomodoroTasks.openBookmark' : 'pomodoroTasks.selectTask',
            title: this.task.isBookmark ? 'Abrir Bookmark' : 'Seleccionar Tarea',
            arguments: [task]
        };
    }

    private getTooltip(): string {
        const completed = this.task.completedPomodoros;
        const status = this.task.isCompleted ? '✅ Completada' : '⏳ Pendiente';
        
        let tooltip = `${this.task.name}\n${status}\nPomodoros completados: ${completed}`;
        
        if (this.task.isBookmark && this.task.filePath && this.task.lineNumber) {
            const fileName = this.task.filePath.split('/').pop() || this.task.filePath;
            tooltip += `\n\n📍 Bookmark en: ${fileName}:${this.task.lineNumber}`;
            tooltip += `\n📁 ${this.task.filePath}`;
        }
        
        if (this.task.description) {
            tooltip += `\n\n${this.task.description}`;
        }
        
        return tooltip;
    }

    private getDescription(): string {
        const completed = this.task.completedPomodoros;
        
        if (this.task.isBookmark && this.task.filePath && this.task.lineNumber) {
            const fileName = this.task.filePath.split('/').pop() || 'archivo';
            return `${completed} 🍅 | 📍 ${fileName}:${this.task.lineNumber}`;
        }
        
        return `${completed} 🍅`;
    }

    private getIcon(): vscode.ThemeIcon {
        if (this.task.isBookmark) {
            // Iconos específicos para bookmarks
            if (this.task.isCompleted) {
                return new vscode.ThemeIcon('bookmark-fill', new vscode.ThemeColor('charts.green'));
            } else {
                return new vscode.ThemeIcon('bookmark', new vscode.ThemeColor('charts.orange'));
            }
        }
        
        // Iconos para tareas normales
        if (this.task.isCompleted) {
            return new vscode.ThemeIcon('check-all', new vscode.ThemeColor('charts.green'));
        } else if (this.task.completedPomodoros > 0) {
            return new vscode.ThemeIcon('clock', new vscode.ThemeColor('charts.yellow'));
        } else {
            return new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('charts.blue'));
        }
    }
}

export class TaskProvider implements vscode.TreeDataProvider<TaskItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TaskItem | undefined | null | void> = new vscode.EventEmitter<TaskItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TaskItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private tasks: Task[] = [];

    constructor(private context: vscode.ExtensionContext) {
        this.loadTasks();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TaskItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TaskItem): Promise<TaskItem[]> {
        if (!element) {
            // Raíz - mostrar todas las tareas
            return Promise.resolve(this.tasks.map(task => 
                new TaskItem(task, vscode.TreeItemCollapsibleState.None)
            ));
        }
        return Promise.resolve([]);
    }

    addTask(task: Task): void {
        this.tasks.push(task);
        this.saveTasks();
        this.refresh();
    }

    updateTask(taskId: string, updates: Partial<Task>): void {
        const index = this.tasks.findIndex(t => t.id === taskId);
        if (index !== -1) {
            this.tasks[index] = { ...this.tasks[index], ...updates };
            this.saveTasks();
            this.refresh();
        }
    }

    deleteTask(taskId: string): void {
        this.tasks = this.tasks.filter(t => t.id !== taskId);
        this.saveTasks();
        this.refresh();
    }

    getTask(taskId: string): Task | undefined {
        return this.tasks.find(t => t.id === taskId);
    }

    getAllTasks(): Task[] {
        return [...this.tasks];
    }

    private saveTasks(): void {
        this.context.globalState.update('pomodoroTasks', this.tasks);
    }

    private loadTasks(): void {
        const savedTasks = this.context.globalState.get<Task[]>('pomodoroTasks', []);
        this.tasks = savedTasks.map((task: any) => ({
            ...task,
            createdAt: new Date(task.createdAt),
            completedAt: task.completedAt ? new Date(task.completedAt) : undefined
        }));
    }

    dispose(): void {
        // Cleanup si es necesario
    }
}