class NavigationLayer {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;
        this.container = sceneManager.container;
        this.navigationContainer = null;
        this.leftArrow = null;
        this.rightArrow = null;
        this.isNightMode = false;
        this.blockHistory = [];
        this.currentBlock = 0;
        this.maxBlocks = 0;
        this.tempMessageTimeout = null;
        this.isBlockDisplayMinimized = true;
        this.colorPalettePanel = null;
        this.isColorPaletteMinimized = true; // Default to compact mode
        this.colorCounts = {
            0: 26, // Steel (initial count)
            1: 0,  // Red
            2: 0,  // Yellow
            3: 0,  // Green
            4: 0,  // Turquoise
            5: 0   // Blue
        };
        this.isBallVisualizationMinimized = true;
        this.ballVisualizationContainer = null;
        this.ballVisualizationLayers = [];
        this.ballVisualizationCircles = {};
        
        // Create cursor element
        this.cursor = document.createElement('div');
        this.cursor.style.position = 'absolute';
        this.cursor.style.width = '15px';
        this.cursor.style.height = '15px';
        this.cursor.style.backgroundColor = this.isNightMode ? '#ffffff' : '#000000';
        this.cursor.style.zIndex = '9999';
        this.cursor.style.pointerEvents = 'none';
        this.cursor.style.display = 'none'; // Initially hidden

        // Add keyboard event listeners
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                this.navigate('prev');
            } else if (e.key === 'ArrowRight') {
                this.navigate('next');
            }
        });
        
        // Check if device is touch-enabled
        const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        if (!isTouchDevice) {
            document.body.appendChild(this.cursor);
        }
        
        // Track cursor position using pointer events
        this.updateCursorPosition = (e) => {
            if (!isTouchDevice) {
                const isOverContainer = this.container.contains(e.target) || this.container === e.target;
                if (isOverContainer) {
                    this.cursor.style.display = 'block';
                    this.cursor.style.left = (e.clientX - 7.5) + 'px';
                    this.cursor.style.top = (e.clientY - 7.5) + 'px';
                    document.body.style.cursor = 'none';
                } else {
                    this.cursor.style.display = 'none';
                    document.body.style.cursor = 'auto';
                }
            }
        };
        
        // Use capture phase to ensure we get the events before Three.js
        if (!isTouchDevice) {
            document.addEventListener('pointermove', this.updateCursorPosition, { capture: true });
            document.addEventListener('mousemove', this.updateCursorPosition, { capture: true });
        }
        
        this.init();
    }

    init() {
        // Create navigation container
        this.navigationContainer = document.createElement('div');
        this.navigationContainer.style.position = 'absolute';
        this.navigationContainer.style.width = '100%';
        this.navigationContainer.style.height = '100%';
        this.navigationContainer.style.pointerEvents = 'none';
        this.navigationContainer.style.zIndex = '1000';
        this.navigationContainer.style.top = '0';
        this.navigationContainer.style.left = '0';
        this.container.appendChild(this.navigationContainer);

        // Create block number display
        this.createBlockDisplay();

        // Create left arrow
        this.leftArrow = this.createArrow('left');
        this.navigationContainer.appendChild(this.leftArrow);

        // Create right arrow
        this.rightArrow = this.createArrow('right');
        this.navigationContainer.appendChild(this.rightArrow);

        // Add event listeners
        this.leftArrow.addEventListener('click', (e) => {
            e.stopPropagation();
            this.navigate('prev');
        });
        this.rightArrow.addEventListener('click', (e) => {
            e.stopPropagation();
            this.navigate('next');
        });

        // Add hover tooltips
        this.addTooltips();

        // Force initial block display update
        this.currentBlockDisplay.innerHTML = `Block #${this.currentBlock.toString().padStart(2, '0')}`;

        // Create color palette panel
        this.createColorPalettePanel();
        
        // Initialize with steel count
        this.updateColorCounts(this.colorCounts);

        // Create ball visualization
        this.createBallVisualization();

        // Add region-based navigation
        this._regionNavPointerDown = null;
        this.container.addEventListener('pointerdown', (e) => {
            // Only left mouse/touch
            if (e.button !== 0) return;
            // Ignore if on UI element
            if (this._isOnUIElement(e)) return;
            this._regionNavPointerDown = { x: e.clientX, y: e.clientY, time: Date.now() };
        });
        this.container.addEventListener('pointerup', (e) => {
            if (e.button !== 0) return;
            if (this._isOnUIElement(e)) return;
            if (!this._regionNavPointerDown) return;
            const dx = e.clientX - this._regionNavPointerDown.x;
            const dy = e.clientY - this._regionNavPointerDown.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const dragThreshold = 10; // px
            if (dist > dragThreshold) return; // treat as drag, not click
            // Only trigger if pointerup is within 500ms of pointerdown
            if (Date.now() - this._regionNavPointerDown.time > 500) return;
            // Determine region
            const w = window.innerWidth;
            if (e.clientX < w * 0.4) {
                this.navigate('prev');
            } else if (e.clientX > w * 0.6) {
                this.navigate('next');
            }
            this._regionNavPointerDown = null;
        });
    }

    createBlockDisplay() {
        // Create block display container
        this.blockDisplay = document.createElement('div');
        this.blockDisplay.style.position = 'absolute';
        this.blockDisplay.style.top = '20px';
        this.blockDisplay.style.left = '20px';
        this.blockDisplay.style.zIndex = '1001';
        this.blockDisplay.style.fontFamily = 'Courier Prime, monospace';
        this.blockDisplay.style.cursor = 'none';
        this.navigationContainer.appendChild(this.blockDisplay);

        // Create current block display
        this.currentBlockDisplay = document.createElement('div');
        this.currentBlockDisplay.style.fontSize = '16px';
        this.currentBlockDisplay.style.marginBottom = '10px';
        this.currentBlockDisplay.style.color = this.isNightMode ? 'rgba(255, 255, 255, 1)' : 'rgba(0, 0, 0, 1)';
        this.currentBlockDisplay.style.transition = 'all 1s ease';
        this.currentBlockDisplay.style.pointerEvents = 'auto';
        this.currentBlockDisplay.style.opacity = '0.6';
        this.blockDisplay.appendChild(this.currentBlockDisplay);

        // Create block history container
        this.blockHistoryContainer = document.createElement('div');
        this.blockHistoryContainer.style.display = 'none';
        this.blockHistoryContainer.style.flexDirection = 'column';
        this.blockHistoryContainer.style.gap = '5px';
        this.blockHistoryContainer.style.transition = 'all 1s ease';
        this.blockHistoryContainer.style.pointerEvents = 'auto';
        this.blockDisplay.appendChild(this.blockHistoryContainer);

        // Add hover and click event listeners
        this.blockDisplay.addEventListener('mouseenter', () => {
            this.cursor.style.backgroundColor = '#a8281d';
            this.cursor.style.transform = 'skewX(-10deg)';
        });

        this.blockDisplay.addEventListener('mouseleave', () => {
            this.cursor.style.backgroundColor = this.isNightMode ? '#ffffff' : '#000000';
            this.cursor.style.transform = 'skewX(0deg)';
        });

        this.blockDisplay.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleBlockDisplay();
        });

        // Force initial block display update
        this.currentBlockDisplay.innerHTML = `Block #${this.currentBlock.toString().padStart(2, '0')}`;
    }

    toggleBlockDisplay() {
        this.isBlockDisplayMinimized = !this.isBlockDisplayMinimized;
        
        if (this.isBlockDisplayMinimized) {
            // Minimize display
            this.currentBlockDisplay.style.fontSize = '16px';
            this.currentBlockDisplay.style.opacity = '0.6';
            this.blockHistoryContainer.style.opacity = '0';
            this.blockHistoryContainer.style.display = 'none';
            
            // Show only block number without coordinates
            const blockNumber = this.currentBlock.toString().padStart(2, '0');
            this.currentBlockDisplay.innerHTML = `Block #${blockNumber}`;
        } else {
            // Restore display
            this.currentBlockDisplay.style.fontSize = '18px';
            this.currentBlockDisplay.style.opacity = '1';
            this.blockHistoryContainer.style.display = 'flex';
            this.blockHistoryContainer.style.opacity = '1';
            
            // Update display with full information
            this.updateBlockDisplay();
        }
    }

    showTemporaryMessage(message) {
        // Clear any existing timeout
        if (this.tempMessageTimeout) {
            clearTimeout(this.tempMessageTimeout);
        }

        // Fade out current message
        this.currentBlockDisplay.style.opacity = '0';

        // After fade out, show temporary message
        setTimeout(() => {
            this.currentBlockDisplay.innerHTML = message;
            this.currentBlockDisplay.style.opacity = '1';

            // After 2 seconds, fade out temporary message and show current block
            this.tempMessageTimeout = setTimeout(() => {
                this.currentBlockDisplay.style.opacity = '0';
                setTimeout(() => {
                    this.updateBlockDisplay();
                    this.currentBlockDisplay.style.opacity = '1';
                }, 300); // Wait for fade out to complete
            }, 2000);
        }, 300); // Wait for fade out to complete
    }

    updateBlockDisplay() {
        const uiManager = this.sceneManager.uiManager;
        if (!uiManager) return;

        const state = uiManager.algorithm.getState();
        const selectedCoord = state.selectedCoord;

        if (this.isBlockDisplayMinimized) {
            // In compact mode, only show block number
            this.currentBlockDisplay.innerHTML = `Block #${this.currentBlock.toString().padStart(2, '0')}`;
        } else {
            // In expanded mode, show full information
            const coordColor = this.isNightMode ? '#cccccc' : '#666666';
            const coordText = selectedCoord ? `<span style="font-size: 16px; color: ${coordColor}; transition: opacity 1s ease;"> (${selectedCoord})</span>` : '';
            this.currentBlockDisplay.innerHTML = `Block #${this.currentBlock.toString().padStart(2, '0')}${coordText}`;
            
            // Update block history
            this.blockHistoryContainer.innerHTML = '';
            const maxHistory = 5;
            const historyToShow = this.blockHistory.slice(-maxHistory).reverse();
            
            historyToShow.forEach((block, index) => {
                const historyItem = document.createElement('div');
                const opacity = 1 - (index / maxHistory);
                historyItem.style.fontSize = '12px';
                historyItem.style.color = this.isNightMode 
                    ? `rgba(255, 255, 255, ${opacity})` 
                    : `rgba(0, 0, 0, ${opacity})`;
                
                // Get the selected coordinate for this block
                const blockState = this.sceneManager?.uiManager?.algorithm?.getStateAt?.(block);
                if (blockState) {
                    const blockCoord = blockState.selectedCoord;
                    const coordText = blockCoord ? `<span style="font-size: 11px; color: ${coordColor}; opacity: ${opacity}; transition: opacity 1s ease;"> (${blockCoord})</span>` : '';
                    historyItem.innerHTML = `Block #${block.toString().padStart(2, '0')}${coordText}`;
                } else {
                    historyItem.innerHTML = `Block #${block.toString().padStart(2, '0')}`;
                }
                this.blockHistoryContainer.appendChild(historyItem);
            });
        }
    }

    createArrow(direction) {
        const arrow = document.createElement('div');
        arrow.style.position = 'absolute';
        arrow.style.width = '40px';
        arrow.style.height = '40px';
        arrow.style.display = 'flex';
        arrow.style.alignItems = 'center';
        arrow.style.justifyContent = 'center';
        arrow.style.cursor = 'none';
        arrow.style.transition = 'opacity 1s ease';
        arrow.style.opacity = '0.2';
        arrow.style.zIndex = '1001';
        arrow.style.pointerEvents = 'auto';
        arrow.style.fontFamily = 'Courier Prime, monospace';

        // Create circles for the arrow
        const circleContainer = document.createElement('div');
        circleContainer.style.position = 'relative';
        circleContainer.style.width = '30px';
        circleContainer.style.height = '30px';
        circleContainer.style.display = 'flex';
        circleContainer.style.alignItems = 'center';
        circleContainer.style.justifyContent = 'center';
        arrow.appendChild(circleContainer);

        // Position the arrow
        if (direction === 'left') {
            circleContainer.style.transform = 'scaleX(-1)'; // Flip horizontally for left arrow
        }

        // Function to update arrow position
        const updateArrowPosition = () => {
            const isPortrait = window.innerHeight > window.innerWidth;
            const isMobile = window.innerWidth < 768; // 768px is a common breakpoint for mobile
            
            if (isPortrait) {
                // Portrait mode - position at bottom
                arrow.style.top = 'auto';
                arrow.style.bottom = '120px';
                arrow.style.transform = 'none';
                
                if (direction === 'left') {
                    arrow.style.left = '35%';
                    arrow.style.transform = 'translateX(-50%)';
                } else {
                    arrow.style.right = '35%';
                    arrow.style.transform = 'translateX(50%)';
                }
            } else {
                // Landscape mode - position at sides
                arrow.style.top = '50%';
                arrow.style.bottom = 'auto';
                arrow.style.transform = 'translateY(-50%)';
                
                const modelWidth = isMobile ? 0.6 : 0.33; // Model takes 60% on mobile, 33% on desktop
                const availableSpace = (1 - modelWidth) / 2; // Space on each side of the model
                const arrowPosition = availableSpace / 2; // Position arrow in the middle of the available space

                if (direction === 'left') {
                    arrow.style.left = `${arrowPosition * 100}%`;
                } else {
                    arrow.style.right = `${arrowPosition * 100}%`;
                }
            }
        };

        // Initial position
        updateArrowPosition();

        // Update position on resize
        window.addEventListener('resize', updateArrowPosition);

        // Create arrow shape with circles
        for (let i = 0; i < 7; i++) {
            const circle = document.createElement('div');
            circle.style.position = 'absolute';
            circle.style.width = '5px';
            circle.style.height = '5px';
            circle.style.borderRadius = '50%';
            circle.style.backgroundColor = this.isNightMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)';
            circle.style.transition = 'all 0.3s ease';
            
            // Position circles in a > shape (will be flipped for left arrow)
            if (i < 4) {
                // First half of the arrow
                circle.style.left = `${i * 5}px`;
                circle.style.top = `${i * 5}px`;
            } else {
                // Second half of the arrow
                const j = i - 4;
                circle.style.left = `${j * 5}px`;
                circle.style.top = `${(6 - j) * 5}px`;
            }
            
            circleContainer.appendChild(circle);
        }

        // Add hover effect
        arrow.addEventListener('pointerenter', () => {
            arrow.style.opacity = '0.8';
            this.cursor.style.backgroundColor = '#a8281d';
            this.cursor.style.transform = 'skewX(-10deg)';
        });

        arrow.addEventListener('pointerleave', () => {
            arrow.style.opacity = '0.2';
            this.cursor.style.backgroundColor = this.isNightMode ? '#ffffff' : '#000000';
            this.cursor.style.transform = 'skewX(0deg)';
        });

        return arrow;
    }

    addTooltips() {
        const tooltipStyle = {
            position: 'absolute',
            top: '130%',
            fontSize: '10px',
            color: this.isNightMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)',
            textAlign: 'center',
            width: '100%',
            transition: 'opacity 0.3s ease',
            opacity: '0',
            zIndex: '1002',
            pointerEvents: 'none',
            fontFamily: 'Courier Prime, monospace',
            marginTop: '5px',
            left: '50%',
            transform: 'translateX(-50%)'
        };

        // Left arrow tooltip
        const leftTooltip = document.createElement('div');
        Object.assign(leftTooltip.style, tooltipStyle);
        leftTooltip.textContent = 'Previous Block';
        this.leftArrow.appendChild(leftTooltip);

        // Right arrow tooltip
        const rightTooltip = document.createElement('div');
        Object.assign(rightTooltip.style, tooltipStyle);
        rightTooltip.textContent = 'Next Block';
        this.rightArrow.appendChild(rightTooltip);

        // Show/hide tooltips on hover
        this.leftArrow.addEventListener('pointerenter', () => {
            leftTooltip.style.opacity = '1';
            this.cursor.style.backgroundColor = '#a8281d';
        });
        this.leftArrow.addEventListener('pointerleave', () => {
            leftTooltip.style.opacity = '0';
            this.cursor.style.backgroundColor = this.isNightMode ? '#ffffff' : '#000000';
        });
        this.rightArrow.addEventListener('pointerenter', () => {
            rightTooltip.style.opacity = '1';
            this.cursor.style.backgroundColor = '#a8281d';
        });
        this.rightArrow.addEventListener('pointerleave', () => {
            rightTooltip.style.opacity = '0';
            this.cursor.style.backgroundColor = this.isNightMode ? '#ffffff' : '#000000';
        });
    }

    navigate(direction) {
        const uiManager = this.sceneManager.uiManager;
        if (!uiManager) {
            console.error('UI Manager not found');
            return;
        }

        if (direction === 'prev') {
            if (this.currentBlock > 0) {
                uiManager.handleStepBackward();
            } else {
                this.showTemporaryMessage('Starter Block');
                this.currentBlockDisplay.style.transition = 'all 0.3s ease';
                
            }
        } else if (direction === 'next') {
            const state = uiManager.algorithm.getState();
            if (!state.isFinished) {
                uiManager.handleStepForward();
            } else {
                this.showTemporaryMessage('Last Block');
                this.currentBlockDisplay.style.transition = 'all 0.3s ease';
            }
        }
    }

    setMaxBlocks(max) {
        this.maxBlocks = max;
    }

    updateBlockNumber(iteration) {
        if (iteration !== this.currentBlock) {
            if (iteration > this.currentBlock) {
                // Moving forward
                this.blockHistory.push(this.currentBlock);
                this.currentBlock = iteration;
            } else {
                // Moving backward
                const index = this.blockHistory.indexOf(iteration);
                if (index !== -1) {
                    // If we're going back to a known block, remove all blocks after it
                    this.blockHistory = this.blockHistory.slice(0, index);
                }
                this.currentBlock = iteration;
            }
            this.updateBlockDisplay();
            
            // Update color counts based on current state
            this.updateColorCountsFromState();
        }
    }

    updateColorCountsFromState() {
        const uiManager = this.sceneManager.uiManager;
        if (!uiManager) return;

        const state = uiManager.algorithm.getState();
        if (!state) return;

        // Reset counts
        const newCounts = {
            0: 26, // Start with 26 steel balls
            1: 0,  // Red
            2: 0,  // Yellow
            3: 0,  // Green
            4: 0,  // Turquoise
            5: 0   // Blue
        };

        // Count colored balls from ballStates
        if (state.ballStates) {
            Object.values(state.ballStates).forEach(colorIndex => {
                if (colorIndex > 0 && newCounts[colorIndex] !== undefined) {
                    newCounts[colorIndex]++;
                    newCounts[0]--; // Decrease steel count
                }
            });
        }

        this.updateColorCounts(newCounts);
    }

    updateNightMode(isNightMode) {
        this.isNightMode = isNightMode;
        const color = isNightMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)';
        this.leftArrow.style.color = color;
        this.rightArrow.style.color = color;
        this.cursor.style.backgroundColor = isNightMode ? '#ffffff' : '#000000';
        
        // Update block display colors
        this.currentBlockDisplay.style.color = isNightMode ? 'rgba(255, 255, 255, 1)' : 'rgba(0, 0, 0, 1)';
        
        // Update history items colors
        const historyItems = this.blockHistoryContainer.children;
        for (let i = 0; i < historyItems.length; i++) {
            const opacity = 1 - (i / 5);
            historyItems[i].style.color = isNightMode 
                ? `rgba(255, 255, 255, ${opacity})` 
                : `rgba(0, 0, 0, ${opacity})`;
        }

        // Update coordinate colors
        this.updateBlockDisplay();

        // Update color palette panel
        const heading = this.colorPalettePanel.querySelector('div');
        heading.style.color = isNightMode ? 'rgba(255, 255, 255, 1)' : 'rgba(0, 0, 0, 1)';
        this.createColorItems();

        // Update ball visualization colors
        Object.values(this.ballVisualizationCircles).forEach(circle => {
            circle.style.borderColor = isNightMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)';
        });
    }

    onResize() {
        this.navigationContainer.style.width = this.container.clientWidth + 'px';
        this.navigationContainer.style.height = this.container.clientHeight + 'px';
    }

    createColorPalettePanel() {
        // Create panel container
        this.colorPalettePanel = document.createElement('div');
        this.colorPalettePanel.style.position = 'absolute';
        this.colorPalettePanel.style.top = '20px';
        this.colorPalettePanel.style.right = '20px';
        this.colorPalettePanel.style.zIndex = '1001';
        this.colorPalettePanel.style.fontFamily = 'Courier Prime, monospace';
        this.colorPalettePanel.style.pointerEvents = 'auto';
        this.navigationContainer.appendChild(this.colorPalettePanel);

        // Create heading
        const heading = document.createElement('div');
        heading.style.fontSize = '15px';
        heading.style.marginBottom = '10px';
        heading.style.color = this.isNightMode ? 'rgba(255, 255, 255, 1)' : 'rgba(0, 0, 0, 1)';
        heading.style.cursor = 'none';
        heading.style.transition = 'all 1s ease';
        heading.style.opacity = '0.6';
        heading.style.textAlign = 'right';
        heading.textContent = 'Colour Palette';
        this.colorPalettePanel.appendChild(heading);

        // Create color items container
        this.colorItemsContainer = document.createElement('div');
        this.colorItemsContainer.style.display = 'none';
        this.colorItemsContainer.style.flexDirection = 'column';
        this.colorItemsContainer.style.gap = '5px';
        this.colorItemsContainer.style.transition = 'all 1s ease';
        this.colorItemsContainer.style.opacity = '0';
        this.colorPalettePanel.appendChild(this.colorItemsContainer);

        // Add hover and click event listeners
        this.colorPalettePanel.addEventListener('mouseenter', () => {
            this.cursor.style.backgroundColor = '#a8281d';
            this.cursor.style.transform = 'skewX(-10deg)';
            heading.style.opacity = '1';
        });

        this.colorPalettePanel.addEventListener('mouseleave', () => {
            this.cursor.style.backgroundColor = this.isNightMode ? '#ffffff' : '#000000';
            this.cursor.style.transform = 'skewX(0deg)';
            if (this.isColorPaletteMinimized) {
                heading.style.opacity = '0.6';
            }
        });

        this.colorPalettePanel.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleColorPalette();
        });

        // Create color items
        this.createColorItems();
    }

    toggleColorPalette() {
        this.isColorPaletteMinimized = !this.isColorPaletteMinimized;
        
        if (this.isColorPaletteMinimized) {
            // Minimize display
            this.colorItemsContainer.style.opacity = '0';
            setTimeout(() => {
                this.colorItemsContainer.style.display = 'none';
            }, 1000); // Wait for fade out to complete
        } else {
            // Expand display
            this.colorItemsContainer.style.display = 'flex';
            this.createColorItems(); // Create items before fading in
            setTimeout(() => {
                this.colorItemsContainer.style.opacity = '1';
            }, 10); // Small delay to ensure display is set before opacity
        }
    }

    createColorItems() {
        const colorNames = {
            0: 'Steel',
            1: 'Red',
            2: 'Yellow',
            3: 'Green',
            4: 'Turquoise',
            5: 'Blue'
        };

        this.colorItemsContainer.innerHTML = '';
        
        if (this.isColorPaletteMinimized) {
            return;
        }

        // In expanded mode, show all items
        this.colorItemsContainer.style.display = 'flex';
        this.colorItemsContainer.style.flexDirection = 'column';
        this.colorItemsContainer.style.gap = '5px';
        
        Object.entries(COLOR_PALETTE).forEach(([index, color]) => {
            const item = document.createElement('div');
            item.style.fontSize = '12px';
            item.style.display = 'flex';
            item.style.justifyContent = 'space-between';
            item.style.width = '120px';
            item.style.alignItems = 'center';
            item.style.transition = 'all 1s ease';
            item.style.opacity = '0.8';
            
            const colorName = colorNames[index];
            const count = this.colorCounts[index] || 0;
            const colorOpacity = count > 0 ? '1' : '0.2';
            
            const colorSpan = document.createElement('span');
            colorSpan.style.color = color;
            colorSpan.style.opacity = colorOpacity;
            colorSpan.textContent = colorName;
            
            const countSpan = document.createElement('span');
            countSpan.style.color = this.isNightMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)';
            countSpan.textContent = `x ${count.toString().padStart(2, '0')}`;
            
            item.appendChild(colorSpan);
            item.appendChild(countSpan);
            this.colorItemsContainer.appendChild(item);
        });
    }

    updateColorCounts(counts) {
        this.colorCounts = counts;
        this.createColorItems();
    }

    createBallVisualization() {
        // Create container for ball visualization
        this.ballVisualizationContainer = document.createElement('div');
        this.ballVisualizationContainer.style.position = 'absolute';
        this.ballVisualizationContainer.style.bottom = '60px';
        this.ballVisualizationContainer.style.left = '30px';
        this.ballVisualizationContainer.style.zIndex = '1001';
        this.ballVisualizationContainer.style.pointerEvents = 'auto';
        this.ballVisualizationContainer.style.cursor = 'none';
        this.navigationContainer.appendChild(this.ballVisualizationContainer);

        // Calculate the shear offset for 10-degree slant (negative for opposite direction)
        const shearOffset = -Math.tan(10 * Math.PI / 180) * 39; // 39px is the new height of the matrix (3 * (12px + 1px gap))

        // Create matrix container for each layer
        for (let i = 0; i < 3; i++) {
            const matrixContainer = document.createElement('div');
            matrixContainer.style.position = 'absolute';
            matrixContainer.style.width = `${39 + Math.abs(shearOffset)}px`; // Width adjusted for shear
            matrixContainer.style.height = '39px'; // 3 * (12px + 1px gap)
            matrixContainer.style.transition = 'all 0.5s ease';
            this.ballVisualizationLayers.push(matrixContainer);
            this.ballVisualizationContainer.appendChild(matrixContainer);

            // Create circles for the matrix
            for (let j = 0; j < 3; j++) {
                for (let k = 0; k < 3; k++) {
                    const circle = document.createElement('div');
                    circle.style.position = 'absolute';
                    circle.style.width = '12px';
                    circle.style.height = '12px';
                    circle.style.borderRadius = '50%';
                    circle.style.border = '1px solid';
                    circle.style.borderColor = this.isNightMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)';
                    circle.style.transition = 'all 0.3s ease';
                    
                    // Calculate position with shear
                    const xOffset = k * 13; // 12px circle + 1px gap
                    const yOffset = (2 - j) * 13.5; // Invert the y-coordinate to match ball states
                    const shearX = yOffset * -Math.tan(10 * Math.PI / 180); // Negative for opposite direction
                    
                    circle.style.left = `${xOffset + shearX}px`;
                    circle.style.top = `${yOffset}px`;
                    matrixContainer.appendChild(circle);

                    // Store circle reference
                    const coord = `${k+1},${j+1},${i+1}`;
                    this.ballVisualizationCircles[coord] = circle;
                }
            }
        }

        // Position layers
        this.updateBallVisualizationLayout();

        // Add click event listener to toggle visualization
        this.ballVisualizationContainer.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleBallVisualization();
        });

        // Add hover effect
        this.ballVisualizationContainer.addEventListener('mouseenter', () => {
            this.cursor.style.backgroundColor = '#a8281d';
            this.cursor.style.transform = 'skewX(-10deg)';
        });

        this.ballVisualizationContainer.addEventListener('mouseleave', () => {
            this.cursor.style.backgroundColor = this.isNightMode ? '#ffffff' : '#000000';
            this.cursor.style.transform = 'skewX(0deg)';
        });
    }

    updateBallVisualizationLayout() {
        if (this.isBallVisualizationMinimized) {
            // Compact mode - all layers centered
            this.ballVisualizationLayers.forEach((layer, index) => {
                layer.style.left = '0';
                layer.style.opacity = index === 1 ? '1' : '0';
            });

            // Add strokes in compact mode
            Object.values(this.ballVisualizationCircles).forEach(circle => {
                circle.style.border = '1px solid';
                circle.style.borderColor = this.isNightMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)';
            });
        } else {
            // Expanded mode - layers spread out to the right
            this.ballVisualizationLayers.forEach((layer, index) => {
                const offset = index * 60; // Spacing between layers, only positive
                layer.style.left = `${offset}px`;
                layer.style.opacity = '1';
            });

            // Remove strokes in expanded mode
            Object.values(this.ballVisualizationCircles).forEach(circle => {
                circle.style.border = 'none';
            });
        }
    }

    updateBallColors(ballStates) {
        if (!ballStates) return;

        // Get the current selected ball from the algorithm state
        const selectedCoord = this.sceneManager.uiManager?.algorithm?.getState()?.selectedCoord;

        // Update circle colors based on ball states
        for (const [coord, colorIndex] of Object.entries(ballStates)) {
            const circle = this.ballVisualizationCircles[coord];
            if (circle) {
                if (this.isBallVisualizationMinimized) {
                    // In compact mode, only show outline
                    circle.style.backgroundColor = 'transparent';
                    circle.style.border = '1px solid';
                    circle.style.borderColor = this.isNightMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)';
                } else {
                    // In expanded mode, show full color
                    const color = COLOR_PALETTE[colorIndex] || COLOR_PALETTE[0];
                    circle.style.backgroundColor = color;
                    
                    // If this is the selected ball, add the highlight border
                    if (coord === selectedCoord) {
                        circle.style.border = '2px solid';
                        circle.style.borderColor = this.isNightMode ? 'rgba(255, 255, 255, 1)' : 'rgba(0, 0, 0, 1)';
                    } else {
                        circle.style.border = 'none';
                    }
                }
            }
        }
    }

    updateSelectedBall(coord) {
        // Reset all circles to default border
        Object.values(this.ballVisualizationCircles).forEach(circle => {
            if (this.isBallVisualizationMinimized) {
                circle.style.border = '1px solid';
                circle.style.borderColor = this.isNightMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)';
            } else {
                circle.style.border = 'none';
            }
        });

        // If there's a selected ball and we're in expanded mode, highlight it
        if (coord && !this.isBallVisualizationMinimized) {
            const selectedCircle = this.ballVisualizationCircles[coord];
            if (selectedCircle) {
                selectedCircle.style.border = '2px solid';
                selectedCircle.style.borderColor = this.isNightMode ? 'rgba(255, 255, 255, 1)' : 'rgba(0, 0, 0, 1)';
            }
        }
    }

    toggleBallVisualization() {
        this.isBallVisualizationMinimized = !this.isBallVisualizationMinimized;
        this.updateBallVisualizationLayout();
        this.updateBallColors(this.sceneManager.uiManager?.algorithm?.getState()?.ballStates);
    }

    _isOnUIElement(e) {
        // Check if event target is any known UI element or their children
        const uiElements = [
            this.leftArrow,
            this.rightArrow,
            this.blockDisplay,
            this.colorPalettePanel,
            this.ballVisualizationContainer
        ];
        return uiElements.some(el => el && (el === e.target || el.contains(e.target)));
    }
} 
