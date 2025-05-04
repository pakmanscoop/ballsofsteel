// Physical dimensions
const BALL_DIAMETER = 22;
const BALL_RADIUS = BALL_DIAMETER / 2;
const CORE_SIDE = 22;
const CONNECTION_DIAMETER = 4;
const CONNECTION_RADIUS = CONNECTION_DIAMETER / 2;
const CONNECTION_INSET = 5; // How far connection goes into ball/core surface
const GRID_SPACING = (69 - BALL_DIAMETER) / 2; // Distance between centers of balls along an edge
const SLANT_ANGLE_DEG = 10;
const SLANT_ANGLE_RAD = THREE.MathUtils.degToRad(SLANT_ANGLE_DEG);
const SLANT_OFFSET_FACTOR = Math.tan(SLANT_ANGLE_RAD); // tan(angle)

// Initial values
const INITIAL_HASH = '0x55ac31f9309a8a914ab889fca907f350321024a60d39670cbb693c9c14638d94'; // Default 64-char hash

// Initial Color Palette (index: hex color) - 0 must be clear/default
const COLOR_PALETTE = {
    0: '#525252', // Clear/Default (grey)
    1: '#a8281d', // Red
    2: '#fcba03', // Yellow
    3: '#13944b', // Green
    4: '#138b94', // Turquoise
    5: '#173599', // Blue
}; 