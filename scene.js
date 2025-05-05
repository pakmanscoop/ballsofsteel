class ThreeSceneManager {
    constructor(containerId, labelContainerId, initialPalette) {
        this.container = document.getElementById(containerId);
        this.labelContainer = document.getElementById(labelContainerId);
        if (!this.container || !this.labelContainer) {
            console.error("Container or Label Container not found!");
            return;
        }
        this.palette = initialPalette;
        this.balls = {}; // Store ball meshes { 'x,y,z': mesh }
        this.connections = []; // Store connection meshes
        this.connectionMap = {}; // Map ball coordinates to their connection meshes
        this.core = null; // Store core mesh
        this.labels = {}; // Store CSS2D labels { 'x,y,z': label }
        this.axesHelper = null;
        this.highlightedBall = null; // Track the currently highlighted ball mesh
        this.highlightedConnection = null; // Track the currently highlighted connection
        this.bendayMaterial = null;
        this.useBendayEffect = true; // Enable Benday effect by default
        this.isNightMode = false;
        this.pulseTime = 0; // Track time for pulsing effect
        this.uiManager = null; // Will be set by UIManager

        // Create glowing material for selected connection
        this.glowMaterial = new THREE.MeshStandardMaterial({
            color: 0x000000,
            metalness: 1.0,
            roughness: 1.0,
            emissive: 0xeec072,
            emissiveIntensity: 0.0
        });

        this.init();
        this.createModelGeometry();
        this.adjustCameraForDevice(); // Now after geometry creation
        this.animate();
        
        // Initialize navigation layer
        this.navigationLayer = new NavigationLayer(this);

        // Add ResizeObserver to handle container resizing
        this.resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                if (entry.target === this.container) {
                    this.onWindowResize();
                }
            }
        });
        this.resizeObserver.observe(this.container);
    }

    // Utility to detect mobile devices (same logic as navigation.js)
    isMobileDevice() {
        return window.innerWidth < 768;
    }

    // Adjust camera position based on device type
    adjustCameraForDevice() {
        if (this.camera) {
            // Slightly further away on phone
            this.camera.position.set(0, 0, this.isMobileDevice() ? 240 : 200);
            this.camera.lookAt(this.scene ? this.scene.position : {x:0,y:0,z:0});
        }
        // Adjust Benday dot size for phone/desktop mode on all ball materials
        const dotSize = this.isMobileDevice() ? 1.2 : 1.1;
        const dotSpacing = this.isMobileDevice() ? 0.018 : 0.02;
        // Update global bendayMaterial if present
        if (this.bendayMaterial && this.bendayMaterial.uniforms) {
            this.bendayMaterial.uniforms.dotSize.value = dotSize;
            this.bendayMaterial.uniforms.dotSpacing.value = dotSpacing;
        }
        // Update all ball materials
        Object.values(this.balls).forEach(ball => {
            if (ball.material && ball.material.uniforms && ball.material.uniforms.dotSize) {
                ball.material.uniforms.dotSize.value = dotSize;
                ball.material.uniforms.dotSpacing.value = dotSpacing;
            }
        });
    }

    init() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf4eFe6); // Off-White background

        // Camera
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
        // Camera Z will be set by adjustCameraForDevice
        this.camera.position.set(0, 0, 200); // Default, will be adjusted
        this.camera.lookAt(this.scene.position);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        // Label Renderer (for coordinates)
        this.labelRenderer = new THREE.CSS2DRenderer();
        this.labelRenderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.labelRenderer.domElement.style.position = 'absolute';
        this.labelRenderer.domElement.style.top = '0px';
        this.labelRenderer.domElement.style.pointerEvents = 'none'; // Important!
        this.labelContainer.appendChild(this.labelRenderer.domElement);

        // Lights
        const ambientLight = new THREE.AmbientLight(0x404040, 2); // Soft ambient light
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
        directionalLight.position.set(1, 1, 1).normalize();
        this.scene.add(directionalLight);
        const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight2.position.set(-1, -0.5, -1).normalize();
        this.scene.add(directionalLight2);

        // Controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true; // Smooth camera movement
        this.controls.dampingFactor = 0.1;
        this.controls.screenSpacePanning = false; // Pan in the plane defined by camera target
        this.controls.enablePan = false; // Disable panning completely
        this.controls.target.set(0, 0, 0); // Ensure the target is at the center

        // Axes Helper (for dev)
        this.axesHelper = new THREE.AxesHelper(50);
        this.axesHelper.visible = false; // Initially hidden
        this.scene.add(this.axesHelper);

        // Resize listener
        window.addEventListener('resize', this.onWindowResize.bind(this), false);

        // Create Benday shader material
        this.bendayMaterial = new THREE.ShaderMaterial({
            uniforms: THREE.UniformsUtils.clone(bendayUniforms),
            vertexShader: bendayShader.vertexShader,
            fragmentShader: bendayShader.fragmentShader,
            side: THREE.FrontSide,
            transparent: true
        });

        // Initialize screen size
        this.bendayMaterial.uniforms.screenSize.value.set(
            this.container.clientWidth,
            this.container.clientHeight
        );

        // Update screen size uniform on resize
        this.onWindowResize = () => {
            const width = this.container.clientWidth;
            const height = this.container.clientHeight;

            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();

            this.renderer.setSize(width, height);
            this.labelRenderer.setSize(width, height);

            // Update shader screen size
            if (this.bendayMaterial) {
                this.bendayMaterial.uniforms.screenSize.value.set(width, height);
            }
        };
    }

    // Calculate position based on grid index (i, j, k) and slant
    getSlantedPosition(i, j, k) {
        // Center the grid around (0,0,0) initially
        const centeredX = (i - 2) * GRID_SPACING; // Shift by 2 since we're using 1-3 range
        const centeredY = (j - 2) * GRID_SPACING; // No inversion needed for Y
        const centeredZ = (2 - k) * GRID_SPACING; // Invert Z so 1 is front

        // Apply slant: Shift X based on Y coordinate
        const slantedX = centeredX + centeredY * SLANT_OFFSET_FACTOR;
        const slantedY = centeredY;
        const slantedZ = centeredZ;

        return new THREE.Vector3(slantedX, slantedY, slantedZ);
    }

    createModelGeometry() {
        // Materials
        const isMobile = this.isMobileDevice();
        const initialDotSize = isMobile ? 0.4 : 0.3;
        const ballMaterial = this.useBendayEffect ? 
            this.bendayMaterial.clone() : 
            new THREE.MeshStandardMaterial({
                color: this.palette[0],
                metalness: 0.3,
                roughness: 0.5,
            });

        // Initialize shader uniforms if using Benday effect
        if (this.useBendayEffect) {
            ballMaterial.uniforms = THREE.UniformsUtils.clone(bendayUniforms);
            ballMaterial.vertexShader = bendayShader.vertexShader;
            ballMaterial.fragmentShader = bendayShader.fragmentShader;
            ballMaterial.side = THREE.FrontSide;
            ballMaterial.transparent = true;
            
            // Initialize screen size
            ballMaterial.uniforms.screenSize.value.set(
                this.container.clientWidth,
                this.container.clientHeight
            );

            // Set default values
            ballMaterial.uniforms.dotSize.value = initialDotSize;
            ballMaterial.uniforms.dotSpacing.value = 0.015;
            ballMaterial.uniforms.outlineThickness.value = 0.6;
        }

        const coreMaterial = new THREE.MeshStandardMaterial({
            color: 0x505050, // Dark grey core
            metalness: 0.6,
            roughness: 0.4,
        });
        const connectionMaterial = new THREE.MeshStandardMaterial({
            color: 0x888888, // Grey connections
            metalness: 0.5,
            roughness: 0.6,
        });

        // --- Create Core (Parallelepiped) ---
        const coreGeometry = new THREE.BoxGeometry(CORE_SIDE, CORE_SIDE, CORE_SIDE);
        const shearMatrix = new THREE.Matrix4();
        shearMatrix.elements[4] = SLANT_OFFSET_FACTOR; // THREE.js matrices are column-major, this is M_xy

        coreGeometry.applyMatrix4(shearMatrix);
        this.core = new THREE.Mesh(coreGeometry, coreMaterial);
        this.scene.add(this.core);

        // --- Create Balls and Connections ---
        const ballGeometry = new THREE.SphereGeometry(BALL_RADIUS, 32, 32);

        for (let k = 1; k <= 3; k++) { // z - layer (1=front, 2=middle, 3=back)
            for (let j = 1; j <= 3; j++) { // y - row (1=bottom, 2=middle, 3=top)
                for (let i = 1; i <= 3; i++) { // x - column (1=left, 2=middle, 3=right)
                    if (i === 2 && j === 2 && k === 2) continue; // Skip center position (2,2,2)

                    const coord = `${i},${j},${k}`;
                    const ballPosition = this.getSlantedPosition(i, j, k);

                    // Create Ball Mesh
                    const ballMesh = new THREE.Mesh(ballGeometry, ballMaterial.clone()); // Clone material for individual color changes
                    ballMesh.position.copy(ballPosition);
                    ballMesh.userData = { coord: coord, type: 'ball', layer: k }; // Store coordinate and type
                    this.scene.add(ballMesh);
                    this.balls[coord] = ballMesh;

                    // Create Coordinate Label (initially hidden)
                    const labelDiv = document.createElement('div');
                    labelDiv.className = 'label';
                    labelDiv.textContent = `(${i},${j},${k})`;
                    const coordLabel = new THREE.CSS2DObject(labelDiv);
                    coordLabel.position.copy(ballPosition);
                    coordLabel.visible = false; // Initially hidden
                    this.labels[coord] = coordLabel;
                    this.scene.add(coordLabel); // Add to the main scene

                    // --- Create Connection ---
                    const coreCenter = this.core.position; // Core is at (0,0,0)
                    const direction = new THREE.Vector3().subVectors(coreCenter, ballPosition).normalize();

                    // Calculate start and end points for the visible cylinder
                    const startPoint = new THREE.Vector3().copy(ballPosition).addScaledVector(direction, BALL_RADIUS - CONNECTION_INSET);
                    const endPoint = new THREE.Vector3().copy(coreCenter).addScaledVector(direction.clone().negate(), CORE_SIDE / 2 - CONNECTION_INSET);

                    const connectionLength = startPoint.distanceTo(endPoint);

                    if (connectionLength > 0.1) { // Only draw if length is significant
                        const connectionGeom = new THREE.CylinderGeometry(CONNECTION_RADIUS, CONNECTION_RADIUS, connectionLength, 16);

                        // Orient the cylinder
                        const connectionMesh = new THREE.Mesh(connectionGeom, connectionMaterial);
                        connectionMesh.position.copy(startPoint).lerp(endPoint, 0.5); // Position at midpoint
                        connectionMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction); // Align Y-axis of cylinder with direction

                        connectionMesh.userData = { type: 'connection', layer: k, coord: coord }; // Store type, layer, and coordinate
                        this.scene.add(connectionMesh);
                        this.connections.push(connectionMesh);
                        this.connectionMap[coord] = connectionMesh; // Store connection reference
                    } else {
                        console.warn(`Connection length too small for ball ${coord}. Skipping.`);
                    }
                }
            }
        }
    }

    updateBallColors(ballStates) {
        if (!this.palette) return;

        for (const coord in ballStates) {
            if (this.balls[coord]) {
                const colorIndex = ballStates[coord];
                const colorHex = this.palette[colorIndex] || this.palette[0];
                
                if (this.useBendayEffect) {
                    const material = this.balls[coord].material;
                    if (material.uniforms) {
                        material.uniforms.dotColor.value.set(colorHex);
                    }
                } else {
                    this.balls[coord].material.color.set(colorHex);
                }
            }
        }

        // Update block number based on current iteration
        if (this.uiManager && this.uiManager.algorithm) {
            const state = this.uiManager.algorithm.getState();
            this.navigationLayer.updateBlockNumber(state.iteration);
        }

        // Update navigation layer's ball visualization
        if (this.navigationLayer) {
            this.navigationLayer.updateBallColors(ballStates);
        }
    }

    highlightBall(coord) {
        // Remove previous highlight
        if (this.highlightedBall && this.highlightedBall.material && this.highlightedBall.material.emissive) {
            this.highlightedBall.material.emissive.setHex(0x000000); // Reset emissive color
        }

        // Reset previous connection material if exists
        if (this.highlightedConnection) {
            this.highlightedConnection.material = new THREE.MeshStandardMaterial({
                color: 0x888888, // Grey connections
                metalness: 0.5,
                roughness: 0.6,
            });
        }

        // Apply new highlight if coord is provided and ball exists
        if (coord && this.balls[coord] && this.balls[coord].material) {
            this.highlightedBall = this.balls[coord];
            if (this.highlightedBall.material.emissive) {
                this.highlightedBall.material.emissive.setHex(this.highlightedBall.material.color.getHex()); // Glow with its own color
                this.highlightedBall.material.emissiveIntensity = 0.6;
            }

            // Update connection material to glowing material
            if (this.connectionMap[coord]) {
                this.highlightedConnection = this.connectionMap[coord];
                this.highlightedConnection.material = this.glowMaterial.clone();
                this.highlightedConnection.material.emissiveIntensity = 0.5; // Initial intensity
            }
        }
    }

    updatePaletteColors(newPalette) {
        this.palette = newPalette;
        // Potentially update existing materials if needed, but usually done via updateBallColors
    }

    // Toggle visibility of objects based on layer index (k)
    setLayerVisibility(layerIndex) { // layerIndex: 0, 1, 2, or -1 for all
        const showAll = (layerIndex === -1);

        Object.values(this.balls).forEach(ball => {
            ball.visible = showAll || ball.userData.layer === layerIndex;
        });
        this.connections.forEach(conn => {
            conn.visible = showAll || conn.userData.layer === layerIndex;
        });

        // Also hide/show labels based on ball visibility
        Object.entries(this.labels).forEach(([coord, label]) => {
            if (this.balls[coord]) {
                label.visible = this.balls[coord].visible && UIManager.getLabelVisibility(); // Also check global toggle
            }
        });
    }

    // Toggle visibility of coordinate labels
    setLabelVisibility(visible) {
        Object.entries(this.labels).forEach(([coord, label]) => {
            // Only show labels for balls that are currently visible (respecting layer filtering)
            label.visible = visible && this.balls[coord]?.visible;
        });
    }

    // Toggle visibility of axes helper
    setAxesVisibility(visible) {
        if (this.axesHelper) {
            this.axesHelper.visible = visible;
        }
    }

    onWindowResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
        this.labelRenderer.setSize(width, height);
        this.adjustCameraForDevice(); // Ensure camera and dot size update on resize
        
        // Update navigation layer size
        this.navigationLayer.onResize();

        // Update shader screen size
        if (this.bendayMaterial) {
            this.bendayMaterial.uniforms.screenSize.value.set(width, height);
        }
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        this.controls.update(); // Only required if controls.enableDamping = true
        
        // Update pulsing effect
        this.pulseTime += 0.01;
        if (this.highlightedConnection) {
            const intensity = 0.5 + 0.3 * Math.sin(this.pulseTime); // Pulsing between 0.2 and 0.8
            this.highlightedConnection.material.emissiveIntensity = intensity;
        }
        
        this.renderer.render(this.scene, this.camera);
        this.labelRenderer.render(this.scene, this.camera); // Render labels
    }

    setBendayEffect(enabled) {
        this.useBendayEffect = enabled;
        this.recreateModelGeometry();
    }

    setBendayDotSize(size) {
        if (this.bendayMaterial) {
            this.bendayMaterial.uniforms.dotSize.value = size;
            // Update all ball materials
            Object.values(this.balls).forEach(ball => {
                if (ball.material.uniforms) {
                    ball.material.uniforms.dotSize.value = size;
                }
            });
        }
    }

    setBendayDotSpacing(spacing) {
        if (this.bendayMaterial) {
            this.bendayMaterial.uniforms.dotSpacing.value = spacing;
            // Update all ball materials
            Object.values(this.balls).forEach(ball => {
                if (ball.material.uniforms) {
                    ball.material.uniforms.dotSpacing.value = spacing;
                }
            });
        }
    }

    setBendayBackgroundColor(color) {
        if (this.bendayMaterial) {
            this.bendayMaterial.uniforms.backgroundColor.value.set(color);
            // Update all ball materials
            Object.values(this.balls).forEach(ball => {
                if (ball.material.uniforms) {
                    ball.material.uniforms.backgroundColor.value.set(color);
                }
            });
        }
    }

    setBendayOutlineColor(color) {
        if (this.bendayMaterial) {
            this.bendayMaterial.uniforms.outlineColor.value.set(color);
            // Update all ball materials
            Object.values(this.balls).forEach(ball => {
                if (ball.material.uniforms) {
                    ball.material.uniforms.outlineColor.value.set(color);
                }
            });
        }
    }

    setBendayOutlineThickness(thickness) {
        if (this.bendayMaterial) {
            this.bendayMaterial.uniforms.outlineThickness.value = thickness;
            // Update all ball materials
            Object.values(this.balls).forEach(ball => {
                if (ball.material.uniforms) {
                    ball.material.uniforms.outlineThickness.value = thickness;
                }
            });
        }
    }

    recreateModelGeometry() {
        // Remove existing geometry
        Object.values(this.balls).forEach(ball => this.scene.remove(ball));
        this.connections.forEach(conn => this.scene.remove(conn));
        if (this.core) this.scene.remove(this.core);

        // Clear arrays
        this.balls = {};
        this.connections = [];
        this.core = null;

        // Recreate geometry
        this.createModelGeometry();
    }

    setSceneBackgroundColor(color) {
        this.scene.background.set(color);
    }

    toggleNightMode() {
        this.isNightMode = !this.isNightMode;
        this.scene.background = new THREE.Color(this.isNightMode ? 0x1a1a1a : 0xf4eFe6);
        this.navigationLayer.updateNightMode(this.isNightMode);
        
        if (this.isNightMode) {
            // Night mode: black background, black dots, black outline
            this.setBendayBackgroundColor('#000000');
            this.setBendayOutlineColor('#000000');
        } else {
            // Day mode: white background, grey dots, black outline
            this.setBendayBackgroundColor('#242424');
            this.setBendayOutlineColor('#000000');
        }
        
        return this.isNightMode;
    }
} 
