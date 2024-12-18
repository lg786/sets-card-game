class Card {
    constructor(suit, value) {
        this.suit = suit;
        this.value = value;
        this.visible = false;
    }

    toString() {
        const valueMap = {
            11: 'J',
            12: 'Q',
            13: 'K',
            14: 'A'
        };
        const suitSymbols = {
            'hearts': '♥',
            'diamonds': '♦',
            'clubs': '♣',
            'spades': '♠'
        };
        const displayValue = valueMap[this.value] || this.value;
        return `${displayValue}${suitSymbols[this.suit]}`;
    }
}

class Player {
    constructor(name) {
        this.name = name;
        this.hand = [];
        this.visibleCardIndices = new Set(); // Store indices of visible cards
        this.prediction = null;
        this.setsWon = 0;
        this.score = 0;
    }
}

class Game {
    constructor() {
        console.log('Initializing new game instance');
        this.players = [];
        this.currentRound = 1;
        this.trumpSuit = null;
        this.currentPlayer = 0;
        this.playerIndex = -1;
        this.gamePhase = 'preview';
        this.visibleCards = []; // Array of indices of visible cards
        this.hands = {};
        this.predictions = {};
        this.setsWon = {};
        this.scores = {};
        this.currentSet = [];
        
        // Bind event listeners
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        console.log('Initializing event listeners');
        const predictionSubmitBtn = document.getElementById('submit-prediction');
        const trumpSubmitBtn = document.getElementById('submit-trump');

        predictionSubmitBtn.addEventListener('click', () => {
            console.log('Prediction submit button clicked');
            const predictionInput = document.getElementById('prediction');
            const prediction = parseInt(predictionInput.value);
            if (isNaN(prediction)) {
                alert('Please enter a valid number');
                return;
            }
            this.submitPrediction(prediction);
        });

        trumpSubmitBtn.addEventListener('click', () => {
            console.log('Trump submit button clicked');
            const trumpSelect = document.getElementById('trump-select');
            this.setTrump(trumpSelect.value);
        });
    }

    updateFromState(gameState) {
        console.log('Updating game from state:', gameState);
        
        try {
            // Update basic game state
            this.currentRound = gameState.round;
            this.trumpSuit = gameState.trumpSuit;
            this.currentPlayer = gameState.currentPlayer;
            this.playerIndex = gameState.playerIndex;
            this.gamePhase = gameState.gamePhase;
            this.players = gameState.players || [];
            this.predictions = gameState.predictions || {};
            this.setsWon = gameState.setsWon || {};
            this.scores = gameState.scores || {};
            this.currentSet = gameState.currentSet || [];
            this.visibleCards = gameState.visibleCards || [];

            // Update hands
            if (gameState.hands) {
                this.hands = {};
                Object.keys(gameState.hands).forEach(playerId => {
                    this.hands[playerId] = gameState.hands[playerId].map(cardData => ({
                        suit: cardData.suit,
                        value: cardData.value
                    }));
                });
            }

            console.log('Game state updated:', {
                phase: this.gamePhase,
                playerIndex: this.playerIndex,
                players: this.players,
                hands: this.hands,
                visibleCards: this.visibleCards
            });

            this.updateUI();
        } catch (error) {
            console.error('Error updating game state:', error);
            console.error('Game state that caused error:', gameState);
            throw error;
        }
    }

    updateUI() {
        console.log('Updating UI with state:', {
            phase: this.gamePhase,
            playerIndex: this.playerIndex,
            currentPlayer: this.currentPlayer,
            players: this.players?.length,
            hands: this.hands ? Object.keys(this.hands).length : 0
        });

        try {
            // Update round and trump information
            document.getElementById('current-round').textContent = this.currentRound;
            document.getElementById('current-trump').textContent = this.trumpSuit || 'Not Set';

            // Update players container
            const playersContainer = document.getElementById('players-container');
            playersContainer.innerHTML = '';
            if (this.players && this.players.length > 0) {
                this.players.forEach((player, index) => {
                    const playerDiv = document.createElement('div');
                    playerDiv.className = `player-info ${index === this.currentPlayer ? 'active' : ''}`;
                    playerDiv.innerHTML = `
                        <div>${player.name}${index === this.currentPlayer ? ' (Current Turn)' : ''}</div>
                        <div>Prediction: ${this.predictions[player.id] !== undefined ? this.predictions[player.id] : '-'}</div>
                        <div>Sets Won: ${this.setsWon[player.id] || 0}</div>
                        <div>Score: ${this.scores[player.id] || 0}</div>
                    `;
                    playersContainer.appendChild(playerDiv);
                });
            }

            // Update current player's hand
            const playerHand = document.getElementById('current-player-hand');
            playerHand.innerHTML = '';
            
            if (this.playerIndex !== -1 && this.players && this.players[this.playerIndex]) {
                const currentPlayer = this.players[this.playerIndex];
                const hand = this.hands[currentPlayer.id];
                
                console.log('Rendering hand:', {
                    playerId: currentPlayer.id,
                    handExists: !!hand,
                    handLength: hand?.length,
                    visibleCards: this.visibleCards
                });

                if (hand && hand.length > 0) {
                    hand.forEach((card, index) => {
                        const cardDiv = document.createElement('div');
                        cardDiv.className = `card ${card.suit}`;
                        const isVisible = this.visibleCards.includes(index);
                        
                        if (isVisible) {
                            cardDiv.textContent = `${card.value}${this.getSuitSymbol(card.suit)}`;
                            if (this.gamePhase === 'play' && this.currentPlayer === this.playerIndex) {
                                cardDiv.addEventListener('click', () => this.playCard(index));
                            }
                        } else {
                            cardDiv.textContent = '?';
                            cardDiv.classList.add('hidden-card');
                        }
                        playerHand.appendChild(cardDiv);
                    });
                }
            }

            // Update played cards
            const playedCards = document.getElementById('played-cards');
            playedCards.innerHTML = '';
            if (this.currentSet && this.currentSet.length > 0) {
                this.currentSet.forEach(playedCard => {
                    const cardDiv = document.createElement('div');
                    cardDiv.className = `card ${playedCard.card.suit}`;
                    cardDiv.textContent = `${playedCard.card.value}${this.getSuitSymbol(playedCard.card.suit)}`;
                    playedCards.appendChild(cardDiv);
                });
            }

            // Update prediction controls
            const predictionControls = document.getElementById('prediction-controls');
            const trumpSelection = document.getElementById('trump-selection');
            const totalPredictions = document.getElementById('total-predictions');
            const totalSets = document.getElementById('total-sets');
            const predictionInput = document.getElementById('prediction');

            predictionControls.classList.add('hidden');
            trumpSelection.classList.add('hidden');

            // Update prediction totals
            const currentTotal = Object.values(this.predictions).reduce((sum, pred) => sum + pred, 0);
            const possibleSets = this.hands[this.players[0].id]?.length || 0;
            totalPredictions.textContent = currentTotal;
            totalSets.textContent = possibleSets;

            // Show appropriate controls
            if (this.gamePhase === 'prediction' && this.currentPlayer === this.playerIndex) {
                predictionControls.classList.remove('hidden');
                // Reset prediction input
                predictionInput.value = '';
                // Set max prediction for last player
                if (this.playerIndex === this.players.length - 1) {
                    const maxAllowed = possibleSets - currentTotal;
                    predictionInput.max = maxAllowed;
                    predictionInput.title = `Cannot predict ${maxAllowed} to make total equal ${possibleSets}`;
                } else {
                    predictionInput.max = possibleSets;
                }
            } else if (this.gamePhase === 'trump' && this.currentPlayer === this.playerIndex) {
                trumpSelection.classList.remove('hidden');
            }

        } catch (error) {
            console.error('Error updating UI:', error);
        }
    }

    getSuitSymbol(suit) {
        const symbols = {
            'hearts': '♥',
            'diamonds': '♦',
            'clubs': '♣',
            'spades': '♠'
        };
        return symbols[suit] || suit;
    }

    playCard(index) {
        if (this.gamePhase !== 'play' || this.currentPlayer !== this.playerIndex) return;
        socket.emit('gameAction', {
            roomCode: currentRoom,
            action: 'playCard',
            data: { cardIndex: index }
        });
    }

    submitPrediction(prediction) {
        console.log('Submitting prediction:', prediction);
        if (this.gamePhase !== 'prediction' || this.currentPlayer !== this.playerIndex) {
            console.warn('Cannot submit prediction now:', {
                phase: this.gamePhase,
                currentPlayer: this.currentPlayer,
                playerIndex: this.playerIndex
            });
            return;
        }

        const possibleSets = this.hands[this.players[0].id]?.length || 0;
        const currentTotal = Object.values(this.predictions).reduce((sum, pred) => sum + pred, 0);

        // Validate prediction
        if (prediction < 0 || prediction > possibleSets) {
            alert(`Prediction must be between 0 and ${possibleSets}`);
            return;
        }

        // Special validation for last player
        if (this.playerIndex === this.players.length - 1) {
            if (currentTotal + prediction === possibleSets) {
                alert(`Last player cannot make prediction that totals to ${possibleSets}`);
                return;
            }
        }

        console.log('Emitting prediction:', {
            roomCode: currentRoom,
            prediction: prediction
        });

        socket.emit('gameAction', {
            roomCode: currentRoom,
            action: 'makePrediction',
            data: { prediction: prediction }
        });
    }

    setTrump(suit) {
        if (this.gamePhase !== 'trump' || this.currentPlayer !== this.playerIndex) return;
        socket.emit('gameAction', {
            roomCode: currentRoom,
            action: 'setTrump',
            data: { trumpSuit: suit }
        });
    }
}

// Create global game instance
const game = new Game();

// UI Management
document.addEventListener('DOMContentLoaded', () => {
    let game = null;

    // Setup screen elements
    const setupScreen = document.getElementById('setup-screen');
    const gameScreen = document.getElementById('game-screen');
    const startGameBtn = document.getElementById('start-game');
    const numPlayersSelect = document.getElementById('num-players');

    // Game screen elements
    const currentRoundSpan = document.getElementById('current-round');
    const currentTrumpSpan = document.getElementById('current-trump');
    const playersContainer = document.getElementById('players-container');
    const playerHand = document.getElementById('current-player-hand');
    const playedCards = document.getElementById('played-cards');
    const predictionControls = document.getElementById('prediction-controls');
    const trumpSelection = document.getElementById('trump-selection');

    startGameBtn.addEventListener('click', () => {
        const numPlayers = parseInt(numPlayersSelect.value);
        game = new Game();
        
        // Create players
        for (let i = 0; i < numPlayers; i++) {
            game.players.push(new Player(`Player ${i + 1}`));
        }

        game.startNewRound();
        setupScreen.classList.add('hidden');
        gameScreen.classList.remove('hidden');
        updateUI();
    });

    function updateUI() {
        // Update round and trump information
        currentRoundSpan.textContent = game.currentRound;
        currentTrumpSpan.textContent = game.trumpSuit || 'Not Set';

        // Update prediction information
        document.getElementById('total-predictions').textContent = game.getCurrentTotalPredictions();
        document.getElementById('total-sets').textContent = game.getTotalPossibleSets();

        // Update players container
        playersContainer.innerHTML = '';
        game.players.forEach((player, index) => {
            const playerDiv = document.createElement('div');
            playerDiv.className = `player-info ${index === game.currentPlayer ? 'active' : ''}`;
            playerDiv.innerHTML = `
                <div>Player ${index + 1}</div>
                <div>Prediction: ${player.prediction !== null ? player.prediction : '-'}</div>
                <div>Sets Won: ${player.setsWon}</div>
                <div>Score: ${player.score}</div>
            `;
            playersContainer.appendChild(playerDiv);
        });

        // Update current player's hand
        playerHand.innerHTML = '';
        const currentPlayer = game.players[game.currentPlayer];
        currentPlayer.hand.forEach((card, index) => {
            const cardDiv = document.createElement('div');
            cardDiv.className = `card ${card.suit}`;
            if (currentPlayer.visibleCardIndices.has(index)) {
                cardDiv.textContent = card.toString();
                if (game.gamePhase === 'play') {
                    cardDiv.addEventListener('click', () => {
                        if (game.playCard(game.currentPlayer, index)) {
                            updateUI();
                        }
                    });
                }
            } else {
                cardDiv.textContent = '?';
                cardDiv.classList.add('hidden-card');
            }
            playerHand.appendChild(cardDiv);
        });

        // Update played cards
        playedCards.innerHTML = '';
        game.currentSet.forEach(playedCard => {
            const cardDiv = document.createElement('div');
            cardDiv.className = `card ${playedCard.card.suit}`;
            cardDiv.textContent = playedCard.card.toString();
            playedCards.appendChild(cardDiv);
        });

        // Show/hide controls based on game phase
        predictionControls.classList.add('hidden');
        trumpSelection.classList.add('hidden');

        if (game.gamePhase === 'preview' || game.gamePhase === 'prediction') {
            if (!game.players[game.currentPlayer].prediction) {
                predictionControls.classList.remove('hidden');
            }
        } else if (game.gamePhase === 'trump' && game.currentPlayer === game.players.findIndex(p => 
            p.prediction === Math.max(...game.players.map(p => p.prediction)))) {
            trumpSelection.classList.remove('hidden');
        }
    }

    // Prediction submission
    document.getElementById('submit-prediction').addEventListener('click', () => {
        const prediction = parseInt(document.getElementById('prediction').value);
        const result = game.submitPrediction(game.currentPlayer, prediction);
        if (result.valid) {
            updateUI();
        } else {
            alert(result.message);
        }
    });

    // Trump selection
    document.getElementById('submit-trump').addEventListener('click', () => {
        const trumpSuit = document.getElementById('trump-select').value;
        game.setTrump(trumpSuit);
        updateUI();
    });
});
