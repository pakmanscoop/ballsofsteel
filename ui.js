class UIManager {
    constructor(algorithm, sceneManager) {
        this.algorithm = algorithm;
        this.sceneManager = sceneManager;
        this.sceneManager.uiManager = this; // Set this UIManager instance in the scene manager
        this.currentState = null;
        this.initializeUI();
        this.addEventListeners();
    }

    initializeUI() {
        this.bindUIElements();
        this.updatePaletteDisplay();
        this.updatePaletteEditor();
        this.updateUI(); // Initial UI update
    }

    bindUIElements() {
        this.iterationCountEl = document.getElementById('iteration-count');
        this.sequenceDisplayEl = document.getElementById('sequence-display');
        this.paletteDisplayEl = document.getElementById('palette-display');
        this.stepBackwardBtn = document.getElementById('step-backward-btn');
        this.resetBtn = document.getElementById('reset-btn');
        this.stepForwardBtn = document.getElementById('step-forward-btn');
        this.messageBoxEl = document.getElementById('message-box');

        // Layer buttons
        this.viewAllBtn = document.getElementById('view-all-btn');
        this.viewFrontBtn = document.getElementById('view-front-btn');
        this.viewMiddleBtn = document.getElementById('view-middle-btn');
        this.viewRearBtn = document.getElementById('view-rear-btn');
        this.layerButtons = [this.viewAllBtn, this.viewFrontBtn, this.viewMiddleBtn, this.viewRearBtn];

        // Dev controls
        this.hashSeedInput = document.getElementById('hash-seed');
        this.randomizeHashBtn = document.getElementById('randomize-hash-btn');
        this.applyHashBtn = document.getElementById('apply-hash-btn');
        this.paletteEditorEl = document.getElementById('palette-editor');
        this.newColorPicker = document.getElementById('new-color-picker');
        this.addColorBtn = document.getElementById('add-color-btn');
        this.toggleLabelsBtn = document.getElementById('toggle-labels-btn');
        this.toggleAxesBtn = document.getElementById('toggle-axes-btn');
        this.debugLogEl = document.getElementById('debug-log');

        // Benday effect controls
        this.toggleBendayBtn = document.getElementById('toggle-benday-btn');
        this.bendayDotSizeSlider = document.getElementById('benday-dot-size');
        this.bendayDotSpacingSlider = document.getElementById('benday-dot-spacing');
        this.bendayBackgroundColorPicker = document.getElementById('benday-background-color');

        // Outline controls
        this.outlineColorPicker = document.getElementById('outline-color-picker');
        this.outlineThicknessSlider = document.getElementById('outline-thickness-slider');
        this.outlineThicknessValue = document.getElementById('outline-thickness-value');

        // Scene background color
        this.sceneBackgroundColorPicker = document.getElementById('scene-background-color');
        this.nightModeBtn = document.getElementById('night-mode-btn');

        // Set initial hash value
        this.hashSeedInput.value = this.algorithm.hashSeed;

        this.dotSizeValue = document.getElementById('dot-size-value');
        this.dotSpacingValue = document.getElementById('dot-spacing-value');
    }

    addEventListeners() {
        this.stepForwardBtn.addEventListener('click', () => this.handleStepForward());
        this.stepBackwardBtn.addEventListener('click', () => this.handleStepBackward());
        this.resetBtn.addEventListener('click', () => this.handleReset());

        // Layer visibility
        this.viewAllBtn.addEventListener('click', () => this.handleLayerChange(-1));
        this.viewFrontBtn.addEventListener('click', () => this.handleLayerChange(0));
        this.viewMiddleBtn.addEventListener('click', () => this.handleLayerChange(1));
        this.viewRearBtn.addEventListener('click', () => this.handleLayerChange(2));

        // Dev controls
        this.randomizeHashBtn.addEventListener('click', () => this.randomizeHash());
        this.applyHashBtn.addEventListener('click', () => this.applyHash());
        this.addColorBtn.addEventListener('click', () => this.addColor());
        this.toggleLabelsBtn.addEventListener('change', (e) => this.sceneManager.setLabelVisibility(e.target.checked));
        this.toggleAxesBtn.addEventListener('change', (e) => this.sceneManager.setAxesVisibility(e.target.checked));

        // Benday effect controls
        this.toggleBendayBtn.addEventListener('change', (e) => {
            this.sceneManager.setBendayEffect(e.target.checked);
        });

        this.bendayDotSizeSlider.addEventListener('input', (e) => {
            const size = parseFloat(e.target.value);
            this.dotSizeValue.textContent = size.toFixed(2);
            this.sceneManager.setBendayDotSize(size);
        });

        this.bendayDotSpacingSlider.addEventListener('input', (e) => {
            const spacing = parseFloat(e.target.value);
            this.dotSpacingValue.textContent = spacing.toFixed(3);
            this.sceneManager.setBendayDotSpacing(spacing);
        });

        this.bendayBackgroundColorPicker.addEventListener('input', (e) => {
            this.sceneManager.setBendayBackgroundColor(e.target.value);
        });

        // Outline controls
        this.outlineColorPicker.addEventListener('input', (e) => {
            this.sceneManager.setBendayOutlineColor(e.target.value);
        });

        this.outlineThicknessSlider.addEventListener('input', (e) => {
            const thickness = parseFloat(e.target.value);
            this.outlineThicknessValue.textContent = thickness.toFixed(2);
            this.sceneManager.setBendayOutlineThickness(thickness);
        });

        // Scene background color
        this.sceneBackgroundColorPicker.addEventListener('input', (e) => {
            this.sceneManager.setSceneBackgroundColor(e.target.value);
        });

        // Night mode toggle
        this.nightModeBtn.addEventListener('click', () => {
            const isNightMode = this.sceneManager.toggleNightMode();
            this.sceneBackgroundColorPicker.value = isNightMode ? '#000000' : '#ffffff';
            this.bendayBackgroundColorPicker.value = isNightMode ? '#ffffff' : '#000000';
            this.outlineColorPicker.value = isNightMode ? '#000000' : '#ffffff';
        });
    }

    handleStepForward() {
        this.clearMessage();
        if (this.algorithm.stepForward()) {
            this.updateUI();
        } else if (this.algorithm.isFinished) {
            this.showMessage("Sequence finished. Cannot step forward.");
        }
    }

    handleStepBackward() {
        this.clearMessage();
        if (this.algorithm.stepBackward()) {
            this.updateUI();
        } else {
            this.showMessage("Cannot step backward further.");
        }
    }

    handleReset() {
        this.clearMessage();
        this.algorithm.initialize(this.algorithm.baseHashSeed); // Use baseHashSeed instead of hashSeed
        this.updateUI();
        // Reset layer view to 'All'
        this.handleLayerChange(-1);
        this.showMessage("Algorithm reset.");
    }

    handleLayerChange(layerIndex) {
        this.sceneManager.setLayerVisibility(layerIndex);
        // Update button active states
        this.layerButtons.forEach((btn, index) => {
            // Map button index to layerIndex (-1 for All at index 0)
            const btnLayer = index - 1;
            btn.dataset.active = (btnLayer === layerIndex);
        });
    }

    randomizeHash() {
        const chars = 'abcdef0123456789';
        let newHash = '';
        for (let i = 0; i < 32; i++) {
            newHash += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        this.hashSeedInput.value = newHash;
        this.applyHash(); // Automatically apply the new random hash
    }

    applyHash() {
        let newHash = this.hashSeedInput.value.trim();
        this.clearMessage();
        if (newHash.length !== 32) {
            // Pad or truncate? For now, enforce 32 chars.
            // Simple padding: repeat first char if too short
            if (newHash.length < 32) {
                newHash = newHash.padEnd(32, newHash[0] || '0');
                this.showMessage("Hash padded to 32 characters.", "warning");
            } else {
                newHash = newHash.substring(0, 32);
                this.showMessage("Hash truncated to 32 characters.", "warning");
            }
            this.hashSeedInput.value = newHash; // Update input field
        }
        this.algorithm.initialize(newHash);
        this.updateUI();
        this.showMessage("New hash applied. Algorithm reset.");
    }

    updateUI() {
        const state = this.algorithm.getState();
        this.iterationCountEl.textContent = state.iteration;

        // Format sequence display
        const sequenceHtml = state.sequence.map((coord, index) => {
            const isLast = index === state.sequence.length - 1;
            return `<span class="${isLast ? 'font-semibold text-blue-600' : ''}">(${coord})</span>`;
        }).join(', ');
        this.sequenceDisplayEl.innerHTML = sequenceHtml || 'N/A';
        // Scroll sequence to bottom
        this.sequenceDisplayEl.scrollTop = this.sequenceDisplayEl.scrollHeight;

        // Update ball colors in the 3D scene
        this.sceneManager.updateBallColors(state.ballStates);

        // Highlight the last selected ball
        this.sceneManager.highlightBall(state.selectedCoord);

        // Update button states
        this.stepForwardBtn.disabled = state.isFinished;
        this.stepBackwardBtn.disabled = state.iteration === 0 || state.sequence.length === 0;
    }

    updatePaletteDisplay() {
        this.paletteDisplayEl.innerHTML = ''; // Clear existing
        const palette = this.algorithm.palette;
        const sortedIndices = Object.keys(palette).map(Number).sort((a, b) => a - b);

        sortedIndices.forEach(index => {
            const color = palette[index];
            const div = document.createElement('div');
            div.classList.add('w-5', 'h-5', 'rounded', 'border', 'border-gray-300', 'flex', 'items-center', 'justify-center', 'text-xs', 'text-white', 'font-bold');
            div.style.backgroundColor = color;
            // Add contrast text color if needed (simple check)
            const brightness = this.getBrightness(color);
            div.style.color = brightness > 128 ? '#000000' : '#ffffff';
            div.textContent = index; // Show index on the color swatch
            div.title = `Index ${index}: ${color}`; // Tooltip
            this.paletteDisplayEl.appendChild(div);
        });
    }

    getBrightness(hexColor) {
        const color = hexColor.substring(1); // Remove #
        const r = parseInt(color.substring(0, 2), 16);
        const g = parseInt(color.substring(2, 4), 16);
        const b = parseInt(color.substring(4, 6), 16);
        // Formula for perceived brightness
        return Math.sqrt(0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b));
    }

    updatePaletteEditor() {
        this.paletteEditorEl.innerHTML = ''; // Clear existing
        const palette = this.algorithm.palette;
        const sortedIndices = Object.keys(palette).map(Number).sort((a, b) => a - b);

        sortedIndices.forEach(index => {
            const color = palette[index];
            const div = document.createElement('div');
            div.classList.add('flex', 'items-center', 'space-x-2');

            const indexLabel = document.createElement('span');
            indexLabel.classList.add('w-6', 'text-sm', 'font-medium', 'text-gray-500');
            indexLabel.textContent = `${index}:`;

            const colorInput = document.createElement('input');
            colorInput.type = 'color';
            colorInput.value = color;
            colorInput.classList.add('p-0', 'h-6', 'w-6', 'border', 'border-gray-300', 'rounded', 'cursor-pointer');
            colorInput.dataset.index = index;
            colorInput.addEventListener('change', (e) => this.updateColor(index, e.target.value));

            const hexInput = document.createElement('input');
            hexInput.type = 'text';
            hexInput.value = color;
            hexInput.classList.add('flex-1', 'p-1', 'border', 'border-gray-300', 'rounded', 'text-xs');
            hexInput.dataset.index = index;
            hexInput.addEventListener('change', (e) => this.updateColor(index, e.target.value));
            // Sync color picker and text input
            colorInput.addEventListener('input', (e) => hexInput.value = e.target.value);
            hexInput.addEventListener('input', (e) => {
                if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                    colorInput.value = e.target.value;
                }
            });

            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'X';
            removeBtn.classList.add('px-2', 'py-0.5', 'bg-red-500', 'text-white', 'rounded', 'text-xs', 'hover:bg-red-600');
            removeBtn.title = 'Remove Color';
            // Disable removing color 0 (default)
            if (index === 0) {
                removeBtn.disabled = true;
                removeBtn.classList.add('opacity-50', 'cursor-not-allowed');
            } else {
                removeBtn.addEventListener('click', () => this.removeColor(index));
            }

            div.appendChild(indexLabel);
            div.appendChild(colorInput);
            div.appendChild(hexInput);
            div.appendChild(removeBtn);
            this.paletteEditorEl.appendChild(div);
        });
    }

    updateColor(index, newColor) {
        // Basic validation for hex color
        if (!/^#[0-9A-F]{6}$/i.test(newColor)) {
            this.showMessage(`Invalid color format: ${newColor}. Use #RRGGBB.`, "error");
            // Revert UI change if possible (tricky without storing old value)
            this.updatePaletteEditor(); // Just redraw for now
            return;
        }

        const newPalette = { ...this.algorithm.palette };
        newPalette[index] = newColor;
        this.algorithm.updatePalette(newPalette);
        this.sceneManager.updatePaletteColors(newPalette); // Update scene manager's copy
        this.updatePaletteDisplay(); // Update the visual display
        this.updatePaletteEditor(); // Redraw editor to reflect change
        this.updateUI(); // Redraw scene with potentially new colors
        this.showMessage(`Color for index ${index} updated.`);
    }

    addColor() {
        const newColor = this.newColorPicker.value;
        const palette = this.algorithm.palette;
        const existingIndices = Object.keys(palette).map(Number);
        const newIndex = existingIndices.length > 0 ? Math.max(...existingIndices) + 1 : 1; // Find next available index (start from 1)

        const newPalette = { ...palette };
        newPalette[newIndex] = newColor;

        this.algorithm.updatePalette(newPalette);
        this.sceneManager.updatePaletteColors(newPalette);
        this.updatePaletteDisplay();
        this.updatePaletteEditor();
        this.updateUI();
        this.showMessage(`Color ${newColor} added at index ${newIndex}.`);
    }

    removeColor(indexToRemove) {
        if (indexToRemove === 0) {
            this.showMessage("Cannot remove the default color (index 0).", "error");
            return;
        }

        const newPalette = { ...this.algorithm.palette };
        delete newPalette[indexToRemove];

        this.algorithm.updatePalette(newPalette);
        this.sceneManager.updatePaletteColors(newPalette);
        this.updatePaletteDisplay();
        this.updatePaletteEditor();
        this.updateUI();
        this.showMessage(`Color at index ${indexToRemove} removed.`);
    }

    static addDebugLog(message) {
        const logEl = document.getElementById('debug-log');
        if (logEl) {
            const time = new Date().toLocaleTimeString();
            const p = document.createElement('p');
            p.textContent = `[${time}] ${message}`;
            logEl.appendChild(p);
            logEl.scrollTop = logEl.scrollHeight; // Scroll to bottom
        }
    }

    showMessage(message, type = "info") {
        this.messageBoxEl.textContent = message;
        this.messageBoxEl.classList.remove('hidden', 'bg-red-100', 'text-red-700', 'border-red-300', 'bg-yellow-100', 'text-yellow-700', 'border-yellow-300', 'bg-blue-100', 'text-blue-700', 'border-blue-300'); // Clear previous styles

        switch (type) {
            case "error":
                this.messageBoxEl.classList.add('bg-red-100', 'text-red-700', 'border-red-300');
                break;
            case "warning":
                this.messageBoxEl.classList.add('bg-yellow-100', 'text-yellow-700', 'border-yellow-300');
                break;
            case "info":
            default:
                this.messageBoxEl.classList.add('bg-blue-100', 'text-blue-700', 'border-blue-300');
                break;
        }
        this.messageBoxEl.classList.remove('hidden');
    }

    clearMessage() {
        this.messageBoxEl.classList.add('hidden');
        this.messageBoxEl.textContent = '';
    }

    // Static method to check label visibility state
    static getLabelVisibility() {
        const toggle = document.getElementById('toggle-labels-btn');
        return toggle ? toggle.checked : false;
    }
} 