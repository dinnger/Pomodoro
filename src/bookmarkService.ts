import * as vscode from 'vscode';
import * as path from 'path';
import { Task } from './types';

export interface BookmarkComment {
    type: 'TODO' | 'FIXME';
    content: string;
    filePath: string;
    lineNumber: number;
    fullLine: string;
}

export class BookmarkService {
    private static readonly COMMENT_PATTERNS = [
        // Patrones para diferentes tipos de comentarios
        /\/\*[\s\S]*?\*\//g,           // Comentarios /* */
        /\/\/.*$/gm,                    // Comentarios //
        /#.*$/gm,                      // Comentarios # (Python, Shell, etc.)
        /<!--[\s\S]*?-->/g,            // Comentarios HTML <!-- -->
        /"""[\s\S]*?"""/g,             // Docstrings Python
        /'''[\s\S]*?'''/g,             // Docstrings Python
        /--.*$/gm,                     // Comentarios SQL --
        /;.*$/gm,                      // Comentarios ; (Lisp, etc.)
        /%.*$/gm,                      // Comentarios % (LaTeX, etc.)
    ];

    private static readonly TODO_FIXME_PATTERN = /\b(TODO|FIXME):\s*(.*)/i;

    /**
     * Busca todos los comentarios TODO y FIXME en el workspace
     */
    static async findBookmarkComments(): Promise<BookmarkComment[]> {
        const bookmarks: BookmarkComment[] = [];
        
        if (!vscode.workspace.workspaceFolders) {
            return bookmarks;
        }

        // Configuración de archivos a incluir/excluir
        const includePattern = '**/*';
        const excludePattern = '{**/node_modules/**,**/out/**,**/dist/**,**/.git/**,**/*.vsix,**/*.min.js}';

        try {
            const files = await vscode.workspace.findFiles(includePattern, excludePattern);
            
            for (const file of files) {
                const fileBookmarks = await this.scanFileForBookmarks(file);
                bookmarks.push(...fileBookmarks);
            }
        } catch (error) {
            console.error('Error buscando archivos:', error);
            vscode.window.showErrorMessage('Error al buscar comentarios en el workspace');
        }

        return bookmarks;
    }

    /**
     * Escanea un archivo específico para buscar comentarios TODO/FIXME
     */
    private static async scanFileForBookmarks(fileUri: vscode.Uri): Promise<BookmarkComment[]> {
        const bookmarks: BookmarkComment[] = [];
        
        try {
            // Verificar si es un archivo de texto/código
            if (!this.isCodeFile(fileUri.fsPath)) {
                return bookmarks;
            }

            const document = await vscode.workspace.openTextDocument(fileUri);
            const content = document.getText();
            const lines = content.split('\n');

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const lineNumber = i + 1;

                // Buscar TODO o FIXME en la línea
                const match = line.match(this.TODO_FIXME_PATTERN);
                if (match) {
                    const type = match[1].toUpperCase() as 'TODO' | 'FIXME';
                    const content = match[2]?.trim() || '';
                    
                    bookmarks.push({
                        type,
                        content,
                        filePath: fileUri.fsPath,
                        lineNumber,
                        fullLine: line.trim()
                    });
                }
            }
        } catch (error) {
            console.error(`Error escaneando archivo ${fileUri.fsPath}:`, error);
        }

        return bookmarks;
    }

    /**
     * Verifica si un archivo es un archivo de código que se debe escanear
     */
    private static isCodeFile(filePath: string): boolean {
        const ext = path.extname(filePath).toLowerCase();
        
        // Extensiones de archivo que se deben escanear
        const codeExtensions = [
            '.ts', '.js', '.tsx', '.jsx', '.json',
            '.py', '.java', '.c', '.cpp', '.h', '.hpp',
            '.cs', '.php', '.rb', '.go', '.rs', '.swift',
            '.kt', '.scala', '.dart', '.vue', '.svelte',
            '.html', '.css', '.scss', '.less', '.sass',
            '.xml', '.yaml', '.yml', '.toml', '.ini',
            '.sql', '.sh', '.ps1', '.bat', '.cmd',
            '.md', '.txt', '.config', '.conf',
            '.dockerfile', '.gitignore', '.env'
        ];

        return codeExtensions.includes(ext) || !ext; // Incluir archivos sin extensión
    }

    /**
     * Convierte un BookmarkComment en una Task
     */
    static createTaskFromBookmark(bookmark: BookmarkComment): Task {
        const fileName = path.basename(bookmark.filePath);
        const relativePath = vscode.workspace.asRelativePath(bookmark.filePath);
        
        // Crear nombre de tarea descriptivo
        const taskName = bookmark.content 
            ? `${bookmark.type}: ${bookmark.content}`
            : `${bookmark.type} en ${fileName}`;

        // Crear descripción con información del archivo y línea
        const description = `📄 ${relativePath}:${bookmark.lineNumber}\n💬 ${bookmark.fullLine}`;

        return {
            id: this.generateBookmarkId(bookmark),
            name: taskName,
            description: description,
            estimatedPomodoros: 1,
            completedPomodoros: 0,
            isCompleted: false,
            createdAt: new Date(),
            isBookmark: true,
            filePath: bookmark.filePath,
            lineNumber: bookmark.lineNumber
        };
    }

    /**
     * Genera un ID único para un bookmark basado en su ubicación
     */
    private static generateBookmarkId(bookmark: BookmarkComment): string {
        const hash = `${bookmark.filePath}:${bookmark.lineNumber}:${bookmark.type}`;
        return `bookmark_${hash.replace(/[^a-zA-Z0-9]/g, '_')}`;
    }

    /**
     * Abre el archivo en la línea correspondiente del bookmark
     */
    static async openBookmarkLocation(task: Task): Promise<void> {
        if (!task.isBookmark || !task.filePath || !task.lineNumber) {
            vscode.window.showWarningMessage('Esta tarea no es un bookmark válido');
            return;
        }

        try {
            const document = await vscode.workspace.openTextDocument(task.filePath);
            const editor = await vscode.window.showTextDocument(document);
            
            // Mover el cursor a la línea del bookmark
            const position = new vscode.Position(task.lineNumber - 1, 0);
            const range = new vscode.Range(position, position);
            
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
            
        } catch (error) {
            console.error('Error abriendo archivo del bookmark:', error);
            vscode.window.showErrorMessage(`No se pudo abrir el archivo: ${task.filePath}`);
        }
    }
}