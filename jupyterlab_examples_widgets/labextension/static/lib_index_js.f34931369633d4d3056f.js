"use strict";
(self["webpackChunk_jupyterlab_examples_widgets"] = self["webpackChunk_jupyterlab_examples_widgets"] || []).push([["lib_index_js"],{

/***/ "./lib/index.js":
/*!**********************!*\
  !*** ./lib/index.js ***!
  \**********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @jupyterlab/apputils */ "webpack/sharing/consume/default/@jupyterlab/apputils");
/* harmony import */ var _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _jupyterlab_launcher__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @jupyterlab/launcher */ "webpack/sharing/consume/default/@jupyterlab/launcher");
/* harmony import */ var _jupyterlab_launcher__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_launcher__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _lumino_widgets__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @lumino/widgets */ "webpack/sharing/consume/default/@lumino/widgets");
/* harmony import */ var _lumino_widgets__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_lumino_widgets__WEBPACK_IMPORTED_MODULE_2__);



/**
 * Activate the whiteboard extension.
 */
const extension = {
    id: '@jupyterlab-examples/whiteboard:plugin',
    autoStart: true,
    requires: [_jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_0__.ICommandPalette, _jupyterlab_launcher__WEBPACK_IMPORTED_MODULE_1__.ILauncher],
    activate: (app, palette, launcher) => {
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
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (extension);
class WhiteboardWidget extends _lumino_widgets__WEBPACK_IMPORTED_MODULE_2__.Widget {
    constructor() {
        super();
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;
        this.eraserMode = false; // Initialize with a default value
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
    startDrawing(event) {
        this.isDrawing = true;
        [this.lastX, this.lastY] = [event.offsetX, event.offsetY];
    }
    draw(event) {
        if (!this.isDrawing)
            return;
        if (this.context === null)
            return;
        if (this.eraserMode) {
            this.context.clearRect(event.offsetX - 10, event.offsetY - 10, 20, 20);
        }
        else {
            this.context.beginPath();
            this.context.moveTo(this.lastX, this.lastY);
            this.context.lineTo(event.offsetX, event.offsetY);
            this.context.stroke();
            [this.lastX, this.lastY] = [event.offsetX, event.offsetY];
        }
    }
    stopDrawing() {
        this.isDrawing = false;
    }
    toggleEraserMode() {
        if (this.context !== null) {
            this.eraserMode = !this.eraserMode;
            this.context.lineCap = this.eraserMode ? 'square' : 'round';
        }
    }
}


/***/ })

}]);
//# sourceMappingURL=lib_index_js.f34931369633d4d3056f.js.map