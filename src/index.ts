import {
    JupyterFrontEnd,
    JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ICommandPalette } from '@jupyterlab/apputils';
import { ILauncher } from '@jupyterlab/launcher';
import { Widget } from '@lumino/widgets';

/**
 * Activate the whiteboard extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
    id: '@jupyterlab-examples/whiteboard:plugin',
    autoStart: true,
    requires: [ICommandPalette, ILauncher],
    activate: (
        app: JupyterFrontEnd,
        palette: ICommandPalette,
        launcher: ILauncher
    ) => {
        const { commands, shell } = app;
        const command = 'whiteboard:open';

        commands.addCommand(command, {
            label: 'Open Whiteboard',
            caption: 'Open a whiteboard to draw on',
            execute: () => {
                const whiteboardWidget = new WhiteboardWidget();
                shell.add(whiteboardWidget, 'main');
            }
        });

        // Add the command to the palette
        palette.addItem({ command, args: {}, category: 'Extension Examples' });

        // Add the widget to the launcher
        launcher.add({
            command: command,
            category: 'Other',
            rank: 0,
        });
    }
};

export default extension;

class WhiteboardWidget extends Widget {
    private context: CanvasRenderingContext2D | null;
    private isDrawing: boolean = false;
    private lastX: number = 0;
    private lastY: number = 0;
    private eraserMode: boolean = false; // Initialize with a default value

    constructor() {
        super();
        this.addClass('whiteboard-widget');
        this.id = 'whiteboard-widget';
        this.title.label = 'Whiteboard';
        this.title.closable = true;

        // Create a canvas element for drawing
        const canvas = document.createElement('canvas');
        canvas.width = 1800;
        canvas.height = 1000;
        this.node.appendChild(canvas);

        // Get the 2D rendering context of the canvas
        this.context = canvas.getContext('2d');
        if (this.context !== null) {
            this.context.strokeStyle = 'black';
            this.context.lineWidth = 2;

            // Add event listeners for drawing on the canvas
            canvas.addEventListener('mousedown', this.startDrawing.bind(this));
            canvas.addEventListener('mousemove', this.draw.bind(this));
            canvas.addEventListener('mouseup', this.stopDrawing.bind(this));
            canvas.addEventListener('mouseout', this.stopDrawing.bind(this));

            // Add event listener for toggling eraser mode
            canvas.addEventListener('dblclick', this.toggleEraserMode.bind(this));
        }
    }

    private startDrawing(event: MouseEvent) {
        this.isDrawing = true;
        [this.lastX, this.lastY] = [event.offsetX, event.offsetY];
    }

    private draw(event: MouseEvent) {
        if (!this.isDrawing) return;
        if (this.context === null) return;

        if (this.eraserMode) {
            this.context.clearRect(
                event.offsetX - 10,
                event.offsetY - 10,
                20,
                20
            );
        } else {
            this.context.beginPath();
            this.context.moveTo(this.lastX, this.lastY);
            this.context.lineTo(event.offsetX, event.offsetY);
            this.context.stroke();
            [this.lastX, this.lastY] = [event.offsetX, event.offsetY];
        }
    }

    private stopDrawing() {
        this.isDrawing = false;
    }

    private toggleEraserMode() {
        if (this.context !== null) {
            this.eraserMode = !this.eraserMode;
            this.context.lineCap = this.eraserMode ? 'square' : 'round';
        }
    }
}


