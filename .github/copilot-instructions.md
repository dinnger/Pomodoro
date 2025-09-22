# Copilot Instructions for Pomodoro Task Manager

## Arquitectura y Componentes Clave
- **Extensión de VS Code**: El código fuente está en `src/` y sigue la estructura típica de una extensión.
- **Gestión de tareas**: `taskProvider.ts` y `taskService.ts` implementan la lógica de CRUD y persistencia de tareas usando el almacenamiento global de VS Code.
- **Temporizador Pomodoro**: `pomodoroTimer.ts` gestiona el temporizador, sesiones, descansos y actualiza la barra de estado.
- **Comandos y UI**: Los comandos se registran en `extension.ts` y se exponen en la paleta y menús contextuales. La vista lateral "Pomodoro Tasks" muestra las tareas.
- **Tipos y modelos**: `types.ts` define los modelos de datos principales (`Task`, `PomodoroSession`, etc.).

## Flujos de Desarrollo
- **Compilar**: `npm run compile` (usa TypeScript, salida en `out/`)
- **Desarrollo rápido**: `npm run watch` recompila automáticamente.
- **Probar en VS Code**: Presiona `F5` para lanzar una ventana de desarrollo con la extensión cargada.
- **Empaquetar**: `vsce package` genera un `.vsix` para distribución.

## Convenciones y Patrones
- **Persistencia**: Las tareas y sesiones se guardan en `context.globalState` bajo las claves `pomodoroTasks` y `pomodoroSessions`.
- **Comandos**: Todos los comandos siguen el prefijo `pomodoroTasks.*` y se documentan en `package.json`.
- **UI reactiva**: Cambios en tareas o temporizador disparan `refresh()` o eventos para actualizar la vista y barra de estado.
- **Configuración**: Las opciones personalizables están bajo el namespace `pomodoroTasks` en la configuración de usuario.
- **Iconografía**: Se usan iconos de VS Code y emojis para estados visuales en la UI.

## Integraciones y Dependencias
- **Solo depende de VS Code y Node.js** (no hay dependencias externas en tiempo de ejecución).
- **No hay tests automatizados** ni scripts de test definidos.

## Ejemplos de patrones clave
- Para agregar una tarea: usa `TaskService.createTask()` y luego `TaskProvider.addTask()`.
- Para iniciar un pomodoro: llama a `PomodoroTimer.startPomodoro(task)` desde un comando o menú contextual.
- Para actualizar la UI tras cambios: siempre invoca `TaskProvider.refresh()` o actualiza la barra de estado.

## Archivos clave
- `src/extension.ts`: punto de entrada y registro de comandos
- `src/taskProvider.ts`, `src/taskService.ts`: lógica de tareas
- `src/pomodoroTimer.ts`: lógica de temporizador
- `src/types.ts`: modelos de datos
- `package.json`: comandos, configuración y metadatos

---

**Sigue estos patrones y flujos para mantener la coherencia y funcionalidad de la extensión.**
