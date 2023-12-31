import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { ICommandPalette } from '@jupyterlab/apputils';
import { ILauncher } from '@jupyterlab/launcher';
import { Widget } from '@lumino/widgets';

// Define the Shape interface
interface Shape {
    type: 'arrow' | 'rectangle' | 'line' | 'circle';
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    color: string;
    timestamp: number;
    globalAlpha: number;
}

type HandDrawnShape = {
    type: 'drawing';
    points: { x: number; y: number }[];
    color: string;
    lineWidth: number;
    timestamp: number;
    globalAlpha: number;
};

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
                const color = whiteboardWidget.getCurrentColorFromToolbar();
                whiteboardWidget.setColor(color);
                shell.add(whiteboardWidget, 'main');
            }
        });

        palette.addItem({ command, category: 'Extension Examples' });

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
    private shapeType: 'arrow' | 'rectangle' | 'line' | 'circle' | null;
    private startShapeX: number;
    private startShapeY: number;
    private savedShapes: Shape[];
    private handDrawnShapes: { type: 'drawing'; points: { x: number; y: number }[]; color: string; lineWidth: number; timestamp: number; globalAlpha: number }[];
    private currentDrawingPoints: { x: number; y: number }[];
    private isDrawing: boolean;
    private eraserMode: boolean;
    private penColorBeforeEraser: string | null = null;
    //private removedShape: Shape | HandDrawnShape | null = null;
    private removedShapesHistory: (Shape | HandDrawnShape)[] = [];

    private setActiveColor(color: string) {
        const colorButtons = this.node.querySelectorAll('.color-button');
        colorButtons.forEach((button: Element) => {
            if (button instanceof HTMLElement) {
                const buttonColor = button.style.backgroundColor;
                if (buttonColor === color) {
                    button.classList.add('active');
                } else {
                    button.classList.remove('active');
                }
            }
        });
    }

    private setInitialActiveColor() {
        const defaultColor = 'black';
        this.setActiveColor(defaultColor);
        if (this.context) {
            this.context.strokeStyle = defaultColor;
        }
    }

    private loadShapesFromFile(event: Event) {
        const fileInput = event.target as HTMLInputElement;
        if (fileInput.files !== null) {
            const file = fileInput.files[0];

            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (event.target !== null) {
                        const shapesData = event.target.result as string;
                        const { savedShapes, handDrawnShapes } = JSON.parse(shapesData);

                        // Clear the canvas before loading shapes
                        if (this.context !== null) {
                            this.context.clearRect(0, 0, this.context.canvas.width, this.context.canvas.height);
                        }

                        this.savedShapes = savedShapes;
                        this.handDrawnShapes = handDrawnShapes;
                        this.drawSavedShapes(); // Draw the loaded shapes
                    }
                };
                reader.readAsText(file);
            }
        }
    }

    constructor() {
        super();
        this.addClass('whiteboard-widget');
        this.id = 'whiteboard-widget';
        this.title.label = 'Whiteboard';
        this.title.closable = true;

        this.shapeType = null;
        this.startShapeX = 0;
        this.startShapeY = 0;
        this.savedShapes = [];
        this.handDrawnShapes = [];
        this.currentDrawingPoints = [];
        this.isDrawing = false;
        this.eraserMode = false;

        const toolbar = document.createElement('div');
        toolbar.className = 'whiteboard-toolbar';
        toolbar.style.display = 'flex';
        toolbar.style.flexDirection = 'row';

        const colors = ['black', 'red', 'green', 'blue', 'cyan', 'magenta', 'yellow'];
        colors.forEach((color) => {
            const colorButton = document.createElement('button');
            colorButton.className = 'color-button';
            colorButton.classList.add(color); // Add the color as a class
            colorButton.style.backgroundColor = color;
            colorButton.addEventListener('click', () => this.setColor(color));
            colorButton.style.fontSize = '16px';
            colorButton.style.padding = '8px 12px';

            // Adjust the width for cyan, magenta, and yellow buttons
            if (color === 'cyan' || color === 'magenta' || color === 'yellow') {
                colorButton.style.width = '40px'; // Adjust the width as needed
            }

            toolbar.appendChild(colorButton);
        });

        const arrowButton = document.createElement('button');
        arrowButton.textContent = 'Arrow';
        arrowButton.className = 'shape-button';
        arrowButton.addEventListener('click', () => this.toggleShapeMode('arrow'));
        arrowButton.style.fontSize = '16px';
        arrowButton.style.padding = '8px 12px';
        toolbar.appendChild(arrowButton);

        const lineButton = document.createElement('button');
        lineButton.textContent = 'Line';
        lineButton.className = 'shape-button';
        lineButton.addEventListener('click', () => this.toggleShapeMode('line'));
        lineButton.style.fontSize = '16px';
        lineButton.style.padding = '8px 12px';
        toolbar.appendChild(lineButton);

        const rectangleButton = document.createElement('button');
        rectangleButton.textContent = 'Rectangle';
        rectangleButton.className = 'shape-button';
        rectangleButton.addEventListener('click', () => this.toggleShapeMode('rectangle'));
        rectangleButton.style.fontSize = '16px';
        rectangleButton.style.padding = '8px 12px';
        toolbar.appendChild(rectangleButton);

        const circleButton = document.createElement('button');
        circleButton.textContent = 'Circle';
        circleButton.className = 'shape-button';
        circleButton.addEventListener('click', () => this.toggleShapeMode('circle'));
        circleButton.style.fontSize = '16px';
        circleButton.style.padding = '8px 12px';
        toolbar.appendChild(circleButton);

        const eraserButton = document.createElement('button');
        eraserButton.textContent = 'Eraser';
        eraserButton.className = 'eraser-button';
        eraserButton.addEventListener('click', () => this.toggleEraserMode());
        eraserButton.style.fontSize = '16px';
        eraserButton.style.padding = '8px 12px';
        toolbar.appendChild(eraserButton);

        const undoButton = document.createElement('button');
        undoButton.textContent = 'Undo';
        undoButton.addEventListener('click', () => this.removeShapeWithHighestTimestamp());

        const redoButton = document.createElement('button');
        redoButton.textContent = 'Redo';
        redoButton.className = 'redo-button'; // Add a class for easier targeting
        redoButton.addEventListener('click', () => this.restoreRemovedShape());
        redoButton.style.backgroundColor = '#9b9d9e'; // Initial background color

        toolbar.appendChild(undoButton);
        toolbar.appendChild(redoButton);

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.style.display = 'none'; // Hide the file input
        fileInput.addEventListener('change', (event) => this.loadShapesFromFile(event));

        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save';
        saveButton.addEventListener('click', async () => {
            const shapesData = JSON.stringify({
                savedShapes: this.savedShapes,
                handDrawnShapes: this.handDrawnShapes
            });

            const blob = new Blob([shapesData], { type: 'application/json' });

            const options = {
                types: [
                    {
                        description: 'JSON Files',
                        accept: {
                            'application/json': ['.json'],
                        },
                    },
                ],
            };

            try {
                const handle = await (window as any).showSaveFilePicker(options);
                const writableStream = await handle.createWritable();
                await writableStream.write(blob);
                await writableStream.close();
            } catch (error) {
                console.error('Error saving file:', error);
            }
        });

        const loadButton = document.createElement('button');
        loadButton.textContent = 'Load';
        loadButton.addEventListener('click', () => fileInput.click());

        toolbar.appendChild(saveButton);
        toolbar.appendChild(loadButton);
        toolbar.appendChild(fileInput);

        const canvas = document.createElement('canvas');
        canvas.width = 1800;
        canvas.height = 1600;
        this.node.appendChild(toolbar);
        this.node.appendChild(canvas);

        this.context = canvas.getContext('2d');
        if (this.context !== null) {
            this.context.strokeStyle = 'black';
            this.context.lineWidth = 2;
            this.context.globalAlpha = 1.0;

            canvas.addEventListener('mousedown', this.startDrawing);
            canvas.addEventListener('mousemove', this.draw);
            canvas.addEventListener('mouseup', this.stopDrawing);
            canvas.addEventListener('mouseout', this.stopDrawing);
        }

        this.setInitialActiveColor();
    }

    public getCurrentColorFromToolbar(): string {
        const activeColorButton = this.node.querySelector('.color-button.active') as HTMLElement;
        return activeColorButton ? activeColorButton.style.backgroundColor : 'black';
    }

    public setColor(color: string) {
        if (this.context) {
            this.context.strokeStyle = color;
        }

        this.eraserMode = false;
        const eraserButton = this.node.querySelector('.eraser-button');

        if (eraserButton instanceof HTMLElement && this.context) {
            if (this.eraserMode) {
                eraserButton.classList.add('active');
                this.context.lineWidth = 20; // Set larger line width for eraser mode
                this.context.globalAlpha = 1.0;
            } else {
                eraserButton.classList.remove('active');
                if (color === 'cyan' || color === 'magenta' || color === 'yellow') {
                    this.context.lineWidth = 10; // Set line width to 10 for these colors
                    this.context.globalAlpha = 0.25; // Set globalAlpha to 0.25 for these colors
                } else {
                    this.context.lineWidth = 2;
                    this.context.globalAlpha = 1.0;
                }
            }
        }

        this.setActiveColor(color);
    }

    private toggleShapeMode(shapeType: 'arrow' | 'rectangle' | 'line' | 'circle') {
        if (this.shapeType === shapeType) {
            this.shapeType = null;
            this.setActiveShape(null); // Deactivate the active shape button
        } else {
            this.shapeType = shapeType;
            this.setActiveShape(shapeType); // Activate the clicked shape button
            this.eraserMode = false;
            const eraserButton = this.node.querySelector('.eraser-button');
            if (eraserButton) {
                eraserButton.classList.remove('active');
            }
        }
    }

    private setActiveShape(shapeType: 'arrow' | 'rectangle' | 'line' | 'circle' | null) {
        const shapeButtons = this.node.querySelectorAll('.shape-button');
        shapeButtons.forEach((button: Element) => {
            if (button instanceof HTMLElement) {
                const buttonShapeType = button.textContent?.toLowerCase();
                if (buttonShapeType === shapeType) {
                    button.classList.toggle('active', true);
                } else {
                    button.classList.toggle('active', false);
                }
            }
        });
    }

    private startDrawing = (event: MouseEvent) => {
        this.isDrawing = true;
        this.startShapeX = event.offsetX;
        this.startShapeY = event.offsetY;
        this.currentDrawingPoints.push({ x: event.offsetX, y: event.offsetY });

        // Clear the array of removed shapes when drawing starts
        this.removedShapesHistory = [];
        this.updateRedoButtonStyle(); // Update the redo button style
    };

    private draw = (event: MouseEvent) => {
        if (!this.isDrawing) return;
        if (this.context === null) return;

        if (this.eraserMode) {
            this.context.beginPath();
            this.context.moveTo(this.currentDrawingPoints[this.currentDrawingPoints.length - 1].x, this.currentDrawingPoints[this.currentDrawingPoints.length - 1].y);
            this.context.lineTo(event.offsetX, event.offsetY);
            this.context.strokeStyle = 'white';
            this.context.lineWidth = 20;
            this.context.globalAlpha = 1.0;
            //this.context.stroke();
            this.context.clearRect(
                event.offsetX - 10,
                event.offsetY - 10,
                20,
                20
            );
            this.currentDrawingPoints.push({ x: event.offsetX, y: event.offsetY });
        } else if (this.shapeType) {
            // Draw shapes (arrow or rectangle)
            const endX = event.offsetX;
            const endY = event.offsetY;
            this.context.clearRect(0, 0, this.context.canvas.width, this.context.canvas.height);
            this.drawSavedShapes();

            const color = this.getCurrentColorFromToolbar();
            const globalAlpha = this.context.globalAlpha;

            if (this.shapeType === 'arrow') {
                this.drawArrow(this.startShapeX, this.startShapeY, endX, endY, color, globalAlpha);
            } else if (this.shapeType === 'rectangle') {
                this.drawRectangle(this.startShapeX, this.startShapeY, endX, endY, color, globalAlpha);
            } else if (this.shapeType === 'line') {
                // Draw line
                this.drawLine(this.startShapeX, this.startShapeY, event.offsetX, event.offsetY, color, globalAlpha);
            } else if (this.shapeType === 'circle') {
                // Draw circle
                this.drawCircle(this.startShapeX, this.startShapeY, event.offsetX, event.offsetY, color, globalAlpha);
            }

        } else {
            // Draw freehand drawing
            this.context.beginPath();
            this.context.moveTo(this.currentDrawingPoints[this.currentDrawingPoints.length - 1].x, this.currentDrawingPoints[this.currentDrawingPoints.length - 1].y);
            this.context.lineTo(event.offsetX, event.offsetY);

            // Update color and line width to match toolbar settings
            const color = this.getCurrentColorFromToolbar();
            this.context.strokeStyle = color;
            if (color === 'cyan' || color === 'magenta' || color === 'yellow') {
                this.context.lineWidth = 10; // Set line width to 10 for these colors
                this.context.globalAlpha = 0.25; // Set globalAlpha to 0.25 for these colors
            } else {
                this.context.lineWidth = 2;
                this.context.globalAlpha = 1.0;
            }

            this.context.stroke();
            this.currentDrawingPoints.push({ x: event.offsetX, y: event.offsetY });
        }
    };

    private stopDrawing = (event: MouseEvent) => {
        if (this.isDrawing) {
            this.isDrawing = false;
            const endX = event.offsetX;
            const endY = event.offsetY;

            if (this.shapeType) {
                // Save shapes
                const color = this.getCurrentColorFromToolbar();
                const timestamp = Date.now(); // Add timestamp

                if (this.shapeType === 'arrow') {
                    this.savedShapes.push({
                        type: 'arrow',
                        startX: this.startShapeX,
                        startY: this.startShapeY,
                        endX,
                        endY,
                        color,
                        timestamp,
                        globalAlpha: this.context!.globalAlpha,
                    });
                } else if (this.shapeType === 'rectangle') {
                    this.savedShapes.push({
                        type: 'rectangle',
                        startX: this.startShapeX,
                        startY: this.startShapeY,
                        endX,
                        endY,
                        color,
                        timestamp,
                        globalAlpha: this.context!.globalAlpha,
                    });
                } else if (this.shapeType === 'line') {
                    this.savedShapes.push({
                        type: 'line',
                        startX: this.startShapeX,
                        startY: this.startShapeY,
                        endX,
                        endY,
                        color,
                        timestamp,
                        globalAlpha: this.context!.globalAlpha,
                    });
                } else if (this.shapeType === 'circle') {
                    this.savedShapes.push({
                        type: 'circle',
                        startX: this.startShapeX,
                        startY: this.startShapeY,
                        endX,
                        endY,
                        color,
                        timestamp,
                        globalAlpha: this.context!.globalAlpha,
                    });
                }

                this.setActiveShape(null);
            }
            else if (this.eraserMode) {
                const color = 'white';
                const timestamp = Date.now(); // Add timestamp

                this.handDrawnShapes.push({
                    type: 'drawing',
                    points: this.currentDrawingPoints,
                    color,
                    lineWidth: this.context!.lineWidth,
                    timestamp,
                    globalAlpha: this.context!.globalAlpha,
                });

            }
            else {
                // Save freehand drawing
                const color = this.getCurrentColorFromToolbar();
                const timestamp = Date.now(); // Add timestamp

                this.handDrawnShapes.push({
                    type: 'drawing',
                    points: this.currentDrawingPoints,
                    color,
                    lineWidth: this.context!.lineWidth,
                    timestamp,
                    globalAlpha: this.context!.globalAlpha,
                });
            }

            this.currentDrawingPoints = [];
            this.shapeType = null;
        }
    };

    private removeShapeWithHighestTimestamp() {
        const shapes = [...this.savedShapes, ...this.handDrawnShapes];
        if (shapes.length > 0) {
            const highestTimestampShape = shapes.reduce((prev, current) => (current.timestamp > prev.timestamp ? current : prev));
            this.removedShapesHistory.push(highestTimestampShape); // Add the removed shape to history
            this.removeShapeFromLists(highestTimestampShape);
            this.clearCanvasAndRedraw();
            this.updateRedoButtonStyle(); // Update the redo button style
        }
    }

    private updateRedoButtonStyle() {
        const redoButton = this.node.querySelector('.redo-button') as HTMLElement;
        if (!redoButton) return;

        if (this.removedShapesHistory.length === 0) {
            redoButton.style.backgroundColor = '#9b9d9e';
        } else {
            redoButton.style.backgroundColor = ''; // Reset to default
        }
    }

    private restoreRemovedShape() {
        if (this.removedShapesHistory.length > 0) {
            const lastRemovedShape = this.removedShapesHistory.pop();
            if (lastRemovedShape) {
                this.addShapeToLists(lastRemovedShape);
                this.clearCanvasAndRedraw();
                this.updateRedoButtonStyle(); // Update the redo button style
            }
        }
    }

    private removeShapeFromLists(shape: Shape | { type: 'drawing'; points: { x: number; y: number }[]; color: string; lineWidth: number; timestamp: number; globalAlpha: number }) {
        if ('type' in shape && shape.type === 'drawing') {
            const index = this.handDrawnShapes.findIndex(s => s === shape);
            if (index !== -1) {
                this.handDrawnShapes.splice(index, 1);
            }
        } else {
            const index = this.savedShapes.findIndex(s => s === shape);
            if (index !== -1) {
                this.savedShapes.splice(index, 1);
            }
        }
    }

    private addShapeToLists(shape: Shape | { type: 'drawing'; points: { x: number; y: number }[]; color: string; lineWidth: number; timestamp: number; globalAlpha: number }) {
        if ('type' in shape && shape.type === 'drawing') {
            this.handDrawnShapes.push(shape);
        } else {
            this.savedShapes.push(shape);
        }
    }

    private clearCanvasAndRedraw() {
        if (this.context) {
            this.context.clearRect(0, 0, this.context.canvas.width, this.context.canvas.height);
            this.drawSavedShapes();
        }
    }

    // Helper functions for drawing arrow, rectangle, hand-drawn shapes, and erasing...
    private drawArrow(startX: number, startY: number, endX: number, endY: number, color: string, globalAlpha: number) {
        if (!this.context) return;
        this.context.beginPath();
        this.context.moveTo(startX, startY);
        this.context.lineTo(endX, endY);
        const arrowAngle = Math.PI / 6;
        const arrowLength = 15;
        const angle = Math.atan2(endY - startY, endX - startX);
        this.context.lineTo(
            endX - arrowLength * Math.cos(angle - arrowAngle),
            endY - arrowLength * Math.sin(angle - arrowAngle)
        );
        this.context.moveTo(endX, endY);
        this.context.lineTo(
            endX - arrowLength * Math.cos(angle + arrowAngle),
            endY - arrowLength * Math.sin(angle + arrowAngle)
        );
        this.context.strokeStyle = color;

        if (color === 'cyan' || color === 'magenta' || color === 'yellow') {
            this.context.lineWidth = 10; // Set line width to 10 for these colors
            this.context.globalAlpha = 0.25; // Set globalAlpha to 0.25 for these colors
        } else {
            this.context.lineWidth = 2;
            this.context.globalAlpha = 1.0;
        }
        this.context.stroke();
    }

    private drawRectangle(startX: number, startY: number, endX: number, endY: number, color: string, globalAlpha: number) {
        if (!this.context) return;
        this.context.beginPath();
        this.context.rect(startX, startY, endX - startX, endY - startY);
        this.context.strokeStyle = color;

        if (color === 'cyan' || color === 'magenta' || color === 'yellow') {
            this.context.lineWidth = 10; // Set line width to 10 for these colors
            this.context.globalAlpha = 0.25; // Set globalAlpha to 0.25 for these colors
        } else {
            this.context.lineWidth = 2;
            this.context.globalAlpha = 1.0;
        }
        this.context.stroke();
    }

    private drawLine(startX: number, startY: number, endX: number, endY: number, color: string, globalAlpha: number) {
        if (!this.context) return;
        this.context.beginPath();
        this.context.moveTo(startX, startY);
        this.context.lineTo(endX, endY);
        this.context.strokeStyle = color;

        if (color === 'cyan' || color === 'magenta' || color === 'yellow') {
            this.context.lineWidth = 10; // Set line width to 10 for these colors
            this.context.globalAlpha = 0.25; // Set globalAlpha to 0.25 for these colors
        } else {
            this.context.lineWidth = 2;
            this.context.globalAlpha = 1.0;
        }
        this.context.stroke();
    }

    private drawCircle(centerX: number, centerY: number, endX: number, endY: number, color: string, globalAlpha: number) {
        if (!this.context) return;
        const radius = Math.sqrt((endX - centerX) ** 2 + (endY - centerY) ** 2);
        this.context.beginPath();
        this.context.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        this.context.strokeStyle = color;

        if (color === 'cyan' || color === 'magenta' || color === 'yellow') {
            this.context.lineWidth = 10; // Set line width to 10 for these colors
            this.context.globalAlpha = 0.25; // Set globalAlpha to 0.25 for these colors
        } else {
            this.context.lineWidth = 2;
            this.context.globalAlpha = 1.0;
        }
        this.context.stroke();
    }

    private drawHandDrawn(points: { x: number; y: number }[], color: string, lineWidth: number, globalAlpha: number) {
        if (!this.context) return;

        this.context.beginPath();
        this.context.strokeStyle = color;
        this.context.lineWidth = lineWidth;
        if (typeof globalAlpha === 'number') {
            this.context.globalAlpha = globalAlpha; // Set globalAlpha if provided
        }
        this.context.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            this.context.lineTo(points[i].x, points[i].y);
        }
        this.context.stroke();
    }

    private drawSavedShapes() {
        if (!this.context) return;

        const allShapes = [...this.savedShapes, ...this.handDrawnShapes];
        allShapes.sort((a, b) => a.timestamp - b.timestamp); // Sort by timestamp

        for (const shape of allShapes) {
            this.context.strokeStyle = shape.color;
            this.context.globalAlpha = shape.globalAlpha || 1.0; // Use the stored globalAlpha if available, otherwise default to 1.0

            if (shape.type === 'arrow') {
                this.drawArrow(shape.startX, shape.startY, shape.endX, shape.endY, shape.color, shape.globalAlpha);
            } else if (shape.type === 'rectangle') {
                this.drawRectangle(shape.startX, shape.startY, shape.endX, shape.endY, shape.color, shape.globalAlpha);
            } else if (shape.type === 'line') {
                this.drawLine(shape.startX, shape.startY, shape.endX, shape.endY, shape.color, shape.globalAlpha);
            } else if (shape.type === 'circle') {
                this.drawCircle(shape.startX, shape.startY, shape.endX, shape.endY, shape.color, shape.globalAlpha);
            } else if (shape.type === 'drawing') {
                this.drawHandDrawn(shape.points, shape.color, shape.lineWidth, shape.globalAlpha);
            }
        }
    }

    private toggleEraserMode() {
        this.eraserMode = !this.eraserMode;
        const eraserButton = this.node.querySelector('.eraser-button');

        if (eraserButton instanceof HTMLElement && this.context) {
            if (this.eraserMode) {
                // Store the current pen color before entering eraser mode
                if (typeof this.context.strokeStyle === 'string') {
                    this.penColorBeforeEraser = this.context.strokeStyle;
                } else {
                    this.penColorBeforeEraser = 'black'; // Default color if context.strokeStyle is not a string
                }

                eraserButton.classList.add('active');
                this.context.strokeStyle = 'white'; // Set color to white for eraser mode
                this.context.lineWidth = 20; // Set larger line width for eraser mode
                this.context.globalAlpha = 1.0;
                this.shapeType = null; // Deactivate any active shape mode
                this.setActiveShape(null); // Deactivate the active shape button
            } else {
                if (this.penColorBeforeEraser) {
                    this.context.strokeStyle = this.penColorBeforeEraser; // Restore pen color
                }

                eraserButton.classList.remove('active');
                this.context.lineWidth = 2; // Restore original line width
                this.context.globalAlpha = 1.0;
            }
        }
    }
}

const style = document.createElement('style');
style.textContent = `
.whiteboard-toolbar .color-button.active,
.whiteboard-toolbar .eraser-button.active,
.whiteboard-toolbar .shape-button.active {
    border: 2px solid #000;
    border-radius: 50%;
}
`;

document.head.appendChild(style);
