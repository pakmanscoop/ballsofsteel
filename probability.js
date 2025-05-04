/**
 * Calculates the selection probability for each ball based on their progression levels.
 * 
 * @param {Object} ballStates - Current state of all balls { 'x,y,z': colorIndex }
 * @param {Object} progressionLevels - How many times each ball has been selected { 'x,y,z': count }
 * @param {number} maxColorIndex - Maximum color index a ball can reach
 * @returns {Object} - Probabilities for each ball { 'x,y,z': probability }
 */
function calculateBallProbabilities(ballStates, progressionLevels, maxColorIndex) {
    const weights = {};
    let totalWeight = 0;

    // First, validate inputs
    if (!ballStates || !progressionLevels || typeof maxColorIndex !== 'number') {
        console.error("Invalid inputs to calculateBallProbabilities");
        return {};
    }

    // Calculate weights for each available ball
    for (const [coord, colorIndex] of Object.entries(ballStates)) {
        // Skip invalid states
        if (typeof colorIndex !== 'number' || colorIndex < 0) {
            console.warn(`Invalid color index for ball ${coord}: ${colorIndex}`);
            continue;
        }

        // Skip balls that have reached or exceeded max color
        if (colorIndex >= maxColorIndex) {
            continue;
        }

        // Ensure progression level exists and is valid
        const progression = progressionLevels[coord] || 0;
        if (typeof progression !== 'number' || progression < 0) {
            console.warn(`Invalid progression level for ball ${coord}: ${progression}`);
            continue;
        }

        // Calculate weight: 1 / (p_i + 1)
        const weight = 1.0 / (progression + 1.0);
        weights[coord] = weight;
        totalWeight += weight;
    }

    // Handle case where no valid weights were calculated
    if (totalWeight === 0 || Object.keys(weights).length === 0) {
        console.warn("No valid weights calculated");
        return {};
    }

    // Convert weights to probabilities with extra precision checks
    const probabilities = {};
    let remainingProbability = 1.0;
    const entries = Object.entries(weights);
    
    // Handle all but the last entry
    for (let i = 0; i < entries.length - 1; i++) {
        const [coord, weight] = entries[i];
        const probability = weight / totalWeight;
        // Ensure probability is valid
        if (probability > 0 && probability <= 1) {
            probabilities[coord] = probability;
            remainingProbability -= probability;
        }
    }

    // Handle the last entry - assign remaining probability
    if (entries.length > 0) {
        const [lastCoord] = entries[entries.length - 1];
        probabilities[lastCoord] = Math.max(0, remainingProbability);
    }

    return probabilities;
}

/**
 * Selects a ball based on the given probabilities and random value.
 * 
 * @param {Object} probabilities - Probabilities for each ball { 'x,y,z': probability }
 * @param {number} randomValue - Random value between 0 and 1
 * @returns {string|null} - Selected ball coordinate or null if no valid selection
 */
function selectBall(probabilities, randomValue) {
    // Validate inputs
    if (!probabilities || typeof randomValue !== 'number' || 
        randomValue < 0 || randomValue > 1 || 
        Object.keys(probabilities).length === 0) {
        console.error("Invalid inputs to selectBall");
        return null;
    }

    // Normalize probabilities to ensure they sum to 1
    const entries = Object.entries(probabilities);
    const totalProb = entries.reduce((sum, [_, prob]) => sum + prob, 0);
    
    if (Math.abs(totalProb - 1) > 0.0001) { // Allow for small floating-point differences
        console.warn(`Total probability (${totalProb}) is not 1, normalizing...`);
        entries.forEach(([coord, prob]) => {
            probabilities[coord] = prob / totalProb;
        });
    }

    let cumulativeProbability = 0;
    let selectedCoord = null;

    // Sort entries by probability (descending) for more deterministic selection
    entries.sort(([, probA], [, probB]) => probB - probA);

    for (const [coord, probability] of entries) {
        cumulativeProbability += probability;
        
        // Use a small epsilon for floating-point comparison
        if (randomValue <= cumulativeProbability || 
            Math.abs(randomValue - cumulativeProbability) < 1e-10) {
            selectedCoord = coord;
            break;
        }
    }

    // Fallback: if no ball was selected due to floating-point issues,
    // select the ball with the highest probability
    if (!selectedCoord && entries.length > 0) {
        console.warn("Using fallback selection due to floating-point precision issues");
        selectedCoord = entries[0][0]; // First entry has highest probability
    }

    return selectedCoord;
} 