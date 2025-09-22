import * as vscode from 'vscode';
import { TaskProvider, TaskItem } from './taskProvider';
import { TaskService } from './taskService';
import { PomodoroTimer } from './pomodoroTimer';
import { PomodoroWebviewProvider } from './pomodoroWebviewProvider';
import { Task } from './types';

export function activate(context: vscode.ExtensionContext) {
    console.log('Activando extensión Pomodoro Task Manager');

    // Habilitar la vista
    vscode.commands.executeCommand('setContext', 'pomodoroTasksEnabled', true);

    // Inicializar componentes
    const taskProvider = new TaskProvider(context);
    const taskService = new TaskService(taskProvider);
    const pomodoroTimer = new PomodoroTimer(context);

    // Registrar WebView Provider
    const webviewProvider = new PomodoroWebviewProvider(
        context.extensionUri,
        pomodoroTimer,
        taskService
    );
    
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            PomodoroWebviewProvider.viewType,
            webviewProvider
        )
    );

    // Registrar vista del árbol (mantener por compatibilidad)
    const treeView = vscode.window.createTreeView('pomodoroTasks', {
        treeDataProvider: taskProvider,
        showCollapseAll: false
    });

    // Eventos del temporizador
    pomodoroTimer.onPomodoroComplete((task: Task) => {
        taskService.incrementPomodoroCount(task.id);
        webviewProvider.updateTasks(); // Actualizar webview
        vscode.window.showInformationMessage(
            `¡Pomodoro completado para "${task.name}"! 🎉`
        );
    });

    // Comandos
    const commands = [
        // Gestión de tareas
        vscode.commands.registerCommand('pomodoroTasks.addTask', () => {
            taskService.createTask();
        }),

        vscode.commands.registerCommand('pomodoroTasks.editTask', (item: TaskItem) => {
            if (item && item.task) {
                taskService.editTask(item.task);
            }
        }),

        vscode.commands.registerCommand('pomodoroTasks.deleteTask', (item: TaskItem) => {
            if (item && item.task) {
                taskService.deleteTask(item.task);
            }
        }),

        vscode.commands.registerCommand('pomodoroTasks.completeTask', (item: TaskItem) => {
            if (item && item.task) {
                taskService.completeTask(item.task);
            }
        }),

        vscode.commands.registerCommand('pomodoroTasks.selectTask', (task: Task) => {
            // Mostrar información de la tarea
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
                        pomodoroTimer.startPomodoro(task);
                        break;
                    case 'Editar':
                        taskService.editTask(task);
                        break;
                    case 'Eliminar':
                        taskService.deleteTask(task);
                        break;
                }
            });
        }),

        // Control del temporizador
        vscode.commands.registerCommand('pomodoroTasks.startPomodoro', (item?: TaskItem) => {
            if (item && item.task) {
                pomodoroTimer.startPomodoro(item.task);
            } else {
                // Mostrar lista de tareas para seleccionar
                const tasks = taskProvider.getAllTasks().filter(t => !t.isCompleted);
                if (tasks.length === 0) {
                    vscode.window.showInformationMessage('No hay tareas disponibles. Crea una tarea primero.');
                    return;
                }

                const taskNames = tasks.map(t => ({
                    label: t.name,
                    description: `${t.completedPomodoros}/${t.estimatedPomodoros} pomodoros`,
                    task: t
                }));

                vscode.window.showQuickPick(taskNames, {
                    placeHolder: 'Selecciona una tarea para iniciar el pomodoro'
                }).then(selected => {
                    if (selected) {
                        pomodoroTimer.startPomodoro(selected.task);
                    }
                });
            }
        }),

        vscode.commands.registerCommand('pomodoroTasks.pausePomodoro', () => {
            const status = pomodoroTimer.getStatus();
            if (status.state === 'running') {
                pomodoroTimer.pausePomodoro();
            } else if (status.state === 'paused') {
                pomodoroTimer.resumePomodoro();
            } else {
                vscode.window.showInformationMessage('No hay ningún pomodoro activo');
            }
        }),

        vscode.commands.registerCommand('pomodoroTasks.stopPomodoro', () => {
            pomodoroTimer.stopPomodoro();
        }),

        vscode.commands.registerCommand('pomodoroTasks.showTimer', () => {
            const status = pomodoroTimer.getStatus();
            if (status.state === 'idle') {
                vscode.window.showInformationMessage(
                    'No hay pomodoro activo',
                    'Iniciar Pomodoro'
                ).then(selection => {
                    if (selection === 'Iniciar Pomodoro') {
                        vscode.commands.executeCommand('pomodoroTasks.startPomodoro');
                    }
                });
            } else {
                const minutes = Math.floor(status.remainingTime / 60);
                const seconds = status.remainingTime % 60;
                const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                
                const taskName = status.currentTask?.name || 'Sin tarea';
                const sessionType = status.sessionType === 'work' ? 'Trabajo' :
                                  status.sessionType === 'shortBreak' ? 'Descanso corto' : 'Descanso largo';
                
                const actions: string[] = [];
                if (status.state === 'running') {
                    actions.push('Pausar');
                } else {
                    actions.push('Reanudar');
                }
                actions.push('Detener');

                vscode.window.showInformationMessage(
                    `${sessionType}: ${taskName}\nTiempo restante: ${timeString}\nPomodoros completados: ${status.completedPomodoros}`,
                    ...actions
                ).then(selection => {
                    switch (selection) {
                        case 'Pausar':
                        case 'Reanudar':
                            vscode.commands.executeCommand('pomodoroTasks.pausePomodoro');
                            break;
                        case 'Detener':
                            vscode.commands.executeCommand('pomodoroTasks.stopPomodoro');
                            break;
                    }
                });
            }
        }),

        // Refrescar vista
        vscode.commands.registerCommand('pomodoroTasks.refresh', () => {
            taskProvider.refresh();
        })
    ];

    // Registrar todos los comandos
    commands.forEach(command => context.subscriptions.push(command));

    // Registrar otros elementos
    context.subscriptions.push(
        treeView,
        pomodoroTimer,
        taskProvider
    );

    console.log('Extensión Pomodoro Task Manager activada exitosamente');
}

export function deactivate() {
    console.log('Desactivando extensión Pomodoro Task Manager');
}