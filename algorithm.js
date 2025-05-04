// Simple PRNG class
class SimplePRNG {
    constructor(seed) {
        this.seed = seed % 2147483647;
        if (this.seed <= 0) this.seed += 2147483646;
    }

    // Park-Miller PRNG
    next() {
        this.seed = (this.seed * 48271) % 2147483647;
        return this.seed;
    }

    // Returns a float between 0 (inclusive) and 1 (exclusive)
    random() {
        return (this.next() - 1) / 2147483646;
    }
}

// Deterministic Sequence Generator class
class DeterministicSequenceGenerator {
    constructor(hashSeed) {
        this.baseSeed = this.hashToSeed(hashSeed);
        this.prng = new SimplePRNG(this.baseSeed);
        this.sequence = [];
        this.states = [];
        this.progressionLevels = {};
    }

    hashToSeed(hash) {
        let seed = 0;
        for (let i = 0; i < hash.length; i++) {
            seed = (seed * 31 + hash.charCodeAt(i)) | 0;
        }
        return Math.abs(seed);
    }

    // Generate a deterministic hash for a specific step
    generateStepHash(iteration, state, progressionLevels) {
        // Sort entries to ensure consistent ordering
        const sortedState = Object.entries(state).sort(([a], [b]) => a.localeCompare(b));
        const sortedProgression = Object.entries(progressionLevels).sort(([a], [b]) => a.localeCompare(b));
        
        const stateString = sortedState.map(([coord, colorIndex]) => `${coord}:${colorIndex}`).join(',');
        const progressionString = sortedProgression.map(([coord, level]) => `${coord}:${level}`).join(',');
        
        const stepData = `${this.baseSeed}:${iteration}:${stateString}:${progressionString}`;
        
        let hash = 0;
        for (let i = 0; i < stepData.length; i++) {
            const char = stepData.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        
        return Math.abs(hash);
    }

    // Calculate probabilities for ball selection
    calculateProbabilities(ballStates, progressionLevels, maxColorIndex) {
        const weights = {};
        let totalWeight = 0;

        // Sort entries for deterministic behavior
        const sortedEntries = Object.entries(ballStates).sort(([a], [b]) => a.localeCompare(b));

        for (const [coord, colorIndex] of sortedEntries) {
            if (colorIndex < maxColorIndex) {
                const weight = 1.0 / (progressionLevels[coord] + 1.0);
                weights[coord] = weight;
                totalWeight += weight;
            }
        }

        if (totalWeight === 0) {
            return {};
        }

        const probabilities = {};
        for (const [coord, weight] of Object.entries(weights)) {
            probabilities[coord] = weight / totalWeight;
        }

        return probabilities;
    }

    // Select a ball based on probabilities and random value
    selectBall(probabilities, randomValue) {
        const sortedEntries = Object.entries(probabilities).sort(([a], [b]) => a.localeCompare(b));
        let cumulativeProbability = 0;

        for (const [coord, probability] of sortedEntries) {
            cumulativeProbability += probability;
            if (randomValue <= cumulativeProbability) {
                return coord;
            }
        }

        return sortedEntries[0]?.[0] || null;
    }

    // Generate the next step in the sequence
    generateNextStep(currentState, currentProgressionLevels, maxColorIndex) {
        const iteration = this.sequence.length;
        const stepHash = this.generateStepHash(iteration, currentState, currentProgressionLevels);
        const stepPrng = new SimplePRNG(stepHash);
        
        const probabilities = this.calculateProbabilities(currentState, currentProgressionLevels, maxColorIndex);
        if (Object.keys(probabilities).length === 0) {
            return null;
        }

        const selectedCoord = this.selectBall(probabilities, stepPrng.random());
        if (!selectedCoord) {
            return null;
        }

        // Create new state and progression levels
        const newState = { ...currentState };
        const newProgressionLevels = { ...currentProgressionLevels };
        
        newState[selectedCoord]++;
        newProgressionLevels[selectedCoord] = (newProgressionLevels[selectedCoord] || 0) + 1;

        return {
            selectedCoord,
            newState,
            newProgressionLevels
        };
    }

    // Pre-compute the entire sequence
    precomputeSequence(initialState, maxColorIndex) {
        this.sequence = [];
        this.states = [initialState];
        this.progressionLevels = {};
        
        // Initialize progression levels
        for (const coord in initialState) {
            this.progressionLevels[coord] = 0;
        }

        let currentState = { ...initialState };
        let currentProgressionLevels = { ...this.progressionLevels };
        
        while (true) {
            // Check if any ball has reached max color
            const hasMaxedBall = Object.values(currentState).some(colorIndex => colorIndex >= maxColorIndex);
            if (hasMaxedBall) {
                break;
            }

            const step = this.generateNextStep(currentState, currentProgressionLevels, maxColorIndex);
            if (!step) break;

            this.sequence.push(step.selectedCoord);
            this.states.push(step.newState);
            currentState = step.newState;
            currentProgressionLevels = step.newProgressionLevels;
        }
    }

    // Get state at a specific iteration
    getStateAt(iteration) {
        if (iteration < 0 || iteration >= this.states.length) {
            return null;
        }

        // Calculate progression levels up to this iteration
        const progressionLevels = {};
        for (const coord in this.states[0]) {
            progressionLevels[coord] = 0;
        }

        for (let i = 0; i < iteration; i++) {
            const coord = this.sequence[i];
            progressionLevels[coord] = (progressionLevels[coord] || 0) + 1;
        }

        return {
            state: this.states[iteration],
            progressionLevels,
            selectedCoord: iteration > 0 ? this.sequence[iteration - 1] : null
        };
    }
}

// Algorithm Logic class
class AlgorithmLogic {
    constructor(hashSeed, initialPalette) {
        this.palette = { ...initialPalette };
        this.maxColorIndex = Math.max(0, Object.keys(this.palette).length - 2);
        this.sequenceGenerator = new DeterministicSequenceGenerator(hashSeed);
        this.initialize(hashSeed);
    }

    initialize(hashSeed) {
        this.baseHashSeed = hashSeed;
        this.iteration = 0;
        this.currentBallStates = this.createInitialState();
        this.sequenceGenerator.precomputeSequence(this.currentBallStates, this.maxColorIndex);
        this.isFinished = false;
        this.updateMaxColorIndex();
        this.log("Algorithm initialized with base seed: " + this.baseHashSeed.substring(0, 8) + "...");
    }

    createInitialState() {
        const state = {};
        for (let k = 1; k <= 3; k++) { // z - layer (1=front, 2=middle, 3=back)
            for (let j = 1; j <= 3; j++) { // y - row (1=bottom, 2=middle, 3=top)
                for (let i = 1; i <= 3; i++) { // x - column (1=left, 2=middle, 3=right)
                    if (i === 2 && j === 2 && k === 2) continue; // Skip center position (2,2,2)
                    const coord = `${i},${j},${k}`;
                    state[coord] = 0; // Start all balls at color 0
                }
            }
        }
        return state;
    }

    updateMaxColorIndex() {
        const colorIndices = Object.keys(this.palette).map(Number).sort((a, b) => a - b);
        this.maxColorIndex = colorIndices.length > 1 ? colorIndices[colorIndices.length - 1] : 0;
    }

    stepForward() {
        if (this.isFinished) {
            this.log("Sequence finished.");
            return false;
        }

        const nextState = this.sequenceGenerator.getStateAt(this.iteration + 1);
        if (!nextState) {
            this.isFinished = true;
            this.log("Sequence finished: No more available balls.");
            return false;
        }

        this.iteration++;
        this.currentBallStates = nextState.state;
        this.log(`Selected ball: ${nextState.selectedCoord}`);
        this.log(`Current color: ${this.currentBallStates[nextState.selectedCoord]}, Max color: ${this.maxColorIndex}`);

        return true;
    }

    stepBackward() {
        if (this.iteration === 0) {
            this.log("Cannot step backward: Already at initial state.");
            return false;
        }

        this.iteration--;
        const prevState = this.sequenceGenerator.getStateAt(this.iteration);
        this.currentBallStates = prevState.state;
        this.isFinished = false;
        this.log(`Stepped back to iteration ${this.iteration}`);

        return true;
    }

    getStateAt(iteration) {
        if (iteration < 0 || iteration >= this.sequenceGenerator.states.length) {
            return null;
        }

        const state = this.sequenceGenerator.getStateAt(iteration);
        if (!state) return null;

        return {
            state: state.state,
            progressionLevels: state.progressionLevels,
            selectedCoord: state.selectedCoord
        };
    }

    getState() {
        const currentState = this.sequenceGenerator.getStateAt(this.iteration);
        return {
            iteration: this.iteration,
            sequence: this.sequenceGenerator.sequence.slice(0, this.iteration),
            ballStates: currentState.state,
            isFinished: this.isFinished,
            selectedCoord: currentState.selectedCoord
        };
    }

    log(message) {
        console.log("[Algorithm] " + message);
        UIManager.addDebugLog("[Algorithm] " + message);
    }
} 