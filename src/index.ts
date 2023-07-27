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
        palette.addItem({ command, category: 'Extension Examples' });

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
    private eraserMode: boolean;

    private setInitialActiveColor() {
        const defaultColor = 'black';
        this.setActiveColor(defaultColor);
        if (this.context) {
            this.context.strokeStyle = defaultColor;
        }
    }

    constructor() {
        super();
        this.addClass('whiteboard-widget');
        this.id = 'whiteboard-widget';
        this.title.label = 'Whiteboard';
        this.title.closable = true;

        this.eraserMode = false; // Initialize the eraserMode

        // Create the toolbar
        const toolbar = document.createElement('div');
        toolbar.className = 'whiteboard-toolbar';
        toolbar.style.display = 'flex';
        toolbar.style.flexDirection = 'row';

        // Add color buttons to the toolbar
        const colors = ['black', 'red', 'green', 'blue'];
        colors.forEach((color) => {
            const colorButton = document.createElement('button');
            colorButton.className = 'color-button';
            colorButton.style.backgroundColor = color;
            colorButton.addEventListener('click', () => this.setColor(color));
            colorButton.style.fontSize = '16px'; // Adjust the font size as desired
            colorButton.style.padding = '8px 12px'; // Add some padding to make the buttons visually bigger
            toolbar.appendChild(colorButton);
        });

        // Add eraser button to the toolbar
        const eraserButton = document.createElement('button');
        eraserButton.textContent = 'Eraser';
        eraserButton.className = 'eraser-button';
        eraserButton.addEventListener('click', () => this.toggleEraserMode());
        eraserButton.style.fontSize = '16px'; // Adjust the font size as desired
        eraserButton.style.padding = '8px 12px'; // Add some padding to make the button visually bigger
        toolbar.appendChild(eraserButton);

        // Insert the toolbar before the canvas
        const canvas = document.createElement('canvas');
        canvas.width = 1800;
        canvas.height = 1600;
        this.node.appendChild(toolbar);
        this.node.appendChild(canvas);

        // Get the 2D rendering context of the canvas
        this.context = canvas.getContext('2d');
        if (this.context !== null) {
            this.context.strokeStyle = 'black';
            this.context.lineWidth = 2;

            let isDrawing = false;
            let lastX = 0;
            let lastY = 0;

            // Helper function to start drawing
            const startDrawing = (event: MouseEvent) => {
                isDrawing = true;
                [lastX, lastY] = [event.offsetX, event.offsetY];
            };

            // Helper function to draw
            const draw = (event: MouseEvent) => {
                if (!isDrawing) return;
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
                    this.context.moveTo(lastX, lastY);
                    this.context.lineTo(event.offsetX, event.offsetY);
                    this.context.stroke();
                    [lastX, lastY] = [event.offsetX, event.offsetY];
                }
            };

            // Helper function to stop drawing
            const stopDrawing = () => {
                isDrawing = false;
            };

            // Add event listeners for drawing on the canvas
            canvas.addEventListener('mousedown', startDrawing);
            canvas.addEventListener('mousemove', draw);
            canvas.addEventListener('mouseup', stopDrawing);
            canvas.addEventListener('mouseout', stopDrawing);

            // Add event listener for toggling eraser mode
            canvas.addEventListener('dblclick', () => {
                this.toggleEraserMode();
            });
        }

        // Set the initial active color (default color as black)
        this.setInitialActiveColor();
    }

    private setActiveColor(color: string) {
        const colorButtons = this.node.querySelectorAll('.color-button');
        colorButtons.forEach((button: Element) => {
            if (button instanceof HTMLElement) {
                const buttonColor = button.style.backgroundColor;
                if (buttonColor === color) {
                    button.classList.add('active'); // Add the active class to the selected color button
                } else {
                    button.classList.remove('active'); // Remove the active class from other color buttons
                }
            }
        });
    }

    // Helper function to set the current color
    private setColor(color: string) {
        if (this.eraserMode) {
            this.eraserMode = false;
            this.setEraserMode(false); // Update the eraser button style
        }

        if (this.context) {
            this.context.strokeStyle = color;
        }

        this.setActiveColor(color); // Update the active class for the color buttons
    }

    private setEraserMode(active: boolean) {
        this.eraserMode = active;
        const eraserButton = this.node.querySelector('.eraser-button');
        if (eraserButton instanceof HTMLElement) {
            if (active) {
                eraserButton.classList.add('active'); // Add the active class to indicate eraser mode
            } else {
                eraserButton.classList.remove('active'); // Remove the active class when eraser mode is off
            }
        }
    }

    private toggleEraserMode() {
        this.setEraserMode(!this.eraserMode);
    }
}

// Add CSS styles for the active buttons
const style = document.createElement('style');
style.textContent = `
.whiteboard-toolbar .color-button.active,
.whiteboard-toolbar .eraser-button.active {
    border: 2px solid #000; /* Add your desired highlight border style */
    border-radius: 50%; /* Add your desired border radius to create a circle effect */
}
`;

document.head.appendChild(style);
