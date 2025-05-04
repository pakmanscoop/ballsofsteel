// Benday dot shader uniforms
const bendayUniforms = {
    dotColor: { value: new THREE.Color(0xcccccc) },
    backgroundColor: { value: new THREE.Color(0x000000) },
    dotSize: { value: 0.2 }, // Base size of dots (0-1)
    dotSpacing: { value: 0.02 }, // Spacing between dots (0-1)
    screenSize: { value: new THREE.Vector2() },
    outlineColor: { value: new THREE.Color(0x000000) },
    outlineThickness: { value: 0.2 } // Thickness of the outline (0-1)
};

// Benday dot shader code
const bendayShader = {
    uniforms: bendayUniforms,
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec3 vWorldPosition;
        varying float vOutline;

        void main() {
            vUv = uv;
            vNormal = normalize(normalMatrix * normal);
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vViewPosition = -mvPosition.xyz;
            vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
            
            // Calculate outline factor based on normal
            vOutline = 1.0 - max(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)), 0.0);
            
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        uniform vec3 dotColor;
        uniform vec3 backgroundColor;
        uniform float dotSize;
        uniform float dotSpacing;
        uniform vec2 screenSize;
        uniform vec3 outlineColor;
        uniform float outlineThickness;

        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec3 vWorldPosition;
        varying float vOutline;

        // Calculate dot pattern
        float dotPattern(vec2 coord, float size, float spacing) {
            // Use actual pixel coordinates instead of normalized UVs for consistent circles
            vec2 pixelPos = coord;
            
            // Scale to create grid with correct aspect ratio
            float gridSize = spacing * screenSize.y; // Base grid on vertical resolution
            vec2 gridPos = mod(pixelPos, gridSize);
            vec2 centerPos = vec2(gridSize * 0.5);
            
            // Distance from center in pixels
            float pixelDist = length(gridPos - centerPos);
            
            // Convert size to pixel radius
            float pixelRadius = size * gridSize * 0.5;
            
            // Create perfectly circular dot with smooth edges
            return 1.0 - smoothstep(pixelRadius - 1.0, pixelRadius, pixelDist);
        }

        void main() {
            // Calculate lighting intensity
            vec3 normal = normalize(vNormal);
            vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
            float lightIntensity = max(dot(normal, lightDir), 0.0);
            
            // Calculate dot size based on lighting
            float adjustedDotSize = dotSize * (1.0 - lightIntensity * 0.5);
            
            // Use actual pixel coordinates
            vec2 pixelCoord = gl_FragCoord.xy;
            
            // Generate dot pattern
            float dot = dotPattern(pixelCoord, adjustedDotSize, dotSpacing);
            
            // Calculate outline
            float outline = smoothstep(1.0 - outlineThickness, 1.0, vOutline);
            
            // Mix between dot color and background color
            vec3 finalColor = mix(backgroundColor, dotColor, dot);
            
            // Apply outline
            finalColor = mix(finalColor, outlineColor, outline);
            
            gl_FragColor = vec4(finalColor, 1.0);
        }
    `
};