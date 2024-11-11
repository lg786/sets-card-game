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
        this.players = [];
        this.currentRound = 1;
        this.trumpSuit = null;
        this.currentPlayer = 0;
        this.deck = [];
        this.playedCards = [];
        this.leadingSuit = null;
        this.predictionsSubmitted = false;
        this.trumpSelected = false;
        this.currentSet = [];
        this.gamePhase = 'preview';
        this.playerIndex = -1; // Current player's index in the game
    }

    initializeFromState(gameState) {
        console.log('Initializing game from state:', gameState);
        this.currentRound = gameState.round;
        this.trumpSuit = gameState.trumpSuit;
        this.currentPlayer = gameState.currentPlayer;
        this.currentSet = gameState.currentSet;
        this.predictions = gameState.predictions;
        this.setsWon = gameState.setsWon;
        this.scores = gameState.scores;
        
        // Initialize deck and deal cards
        this.initializeDeck();
        this.shuffleDeck();
        this.dealCards();
        
        this.updateUI();
    }

    updateFromState(gameState) {
        console.log('Updating game from state:', gameState);
        this.currentRound = gameState.round;
        this.trumpSuit = gameState.trumpSuit;
        this.currentPlayer = gameState.currentPlayer;
        this.currentSet = gameState.currentSet;
        this.predictions = gameState.predictions;
        this.setsWon = gameState.setsWon;
        this.scores = gameState.scores;
        
        this.updateUI();
    }

    initializeDeck() {
        const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
        const numPlayers = this.players.length;
        
        this.deck = [];
        for (let suit of suits) {
            for (let value = 2; value <= 14; value++) {
                if (numPlayers === 5 && value === 2 && (suit === 'spades' || suit === 'hearts')) continue;
                if (numPlayers === 6 && value === 2) continue;
                this.deck.push(new Card(suit, value));
            }
        }
    }

    shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    dealCards() {
        const cardsPerPlayer = Math.floor(this.deck.length / this.players.length);
        for (let i = 0; i < this.players.length; i++) {
            this.players[i].hand = this.deck.slice(i * cardsPerPlayer, (i + 1) * cardsPerPlayer);
            if (i === this.playerIndex) {
                // Only show 4 random cards initially to the current player
                const indices = new Set();
                while (indices.size < 4) {
                    indices.add(Math.floor(Math.random() * this.players[i].hand.length));
                }
                this.players[i].hand.forEach((card, index) => {
                    card.visible = indices.has(index);
                });
            }
        }
    }

    makeCardVisible(playerIndex, cardIndex) {
        if (playerIndex >= 0 && playerIndex < this.players.length) {
            const player = this.players[playerIndex];
            if (cardIndex >= 0 && cardIndex < player.hand.length) {
                player.hand[cardIndex].visible = true;
            }
        }
    }

    makeAllCardsVisible() {
        this.players.forEach(player => {
            player.hand.forEach(card => card.visible = true);
        });
    }

    playCard(cardIndex) {
        if (this.gamePhase !== 'play' || this.currentPlayer !== this.playerIndex) return false;
        
        const player = this.players[this.playerIndex];
        const card = player.hand[cardIndex];

        // Emit the card play event
        socket.emit('gameAction', {
            roomCode: currentRoom,
            action: 'playCard',
            data: {
                cardIndex: cardIndex,
                card: {
                    suit: card.suit,
                    value: card.value
                }
            }
        });

        return true;
    }

    submitPrediction(prediction) {
        if (this.gamePhase !== 'prediction' || this.currentPlayer !== this.playerIndex) return false;

        socket.emit('gameAction', {
            roomCode: currentRoom,
            action: 'makePrediction',
            data: {
                prediction: prediction
            }
        });

        return true;
    }

    setTrump(suit) {
        if (this.gamePhase !== 'trump' || this.currentPlayer !== this.playerIndex) return false;

        socket.emit('gameAction', {
            roomCode: currentRoom,
            action: 'setTrump',
            data: {
                trumpSuit: suit
            }
        });

        return true;
    }

    updateUI() {
        // Update round and trump information
        document.getElementById('current-round').textContent = this.currentRound;
        document.getElementById('current-trump').textContent = this.trumpSuit || 'Not Set';

        // Update players container
        const playersContainer = document.getElementById('players-container');
        playersContainer.innerHTML = '';
        this.players.forEach((player, index) => {
            const playerDiv = document.createElement('div');
            playerDiv.className = `player-info ${index === this.currentPlayer ? 'active' : ''}`;
            playerDiv.innerHTML = `
                <div>${player.name}</div>
                <div>Prediction: ${this.predictions[player.id] !== undefined ? this.predictions[player.id] : '-'}</div>
                <div>Sets Won: ${this.setsWon[player.id] || 0}</div>
                <div>Score: ${this.scores[player.id] || 0}</div>
            `;
            playersContainer.appendChild(playerDiv);
        });

        // Update current player's hand
        const playerHand = document.getElementById('current-player-hand');
        playerHand.innerHTML = '';
        if (this.playerIndex !== -1) {
            const currentPlayer = this.players[this.playerIndex];
            currentPlayer.hand.forEach((card, index) => {
                const cardDiv = document.createElement('div');
                cardDiv.className = `card ${card.suit}`;
                if (card.visible) {
                    cardDiv.textContent = card.toString();
                    cardDiv.addEventListener('click', () => this.playCard(index));
                } else {
                    cardDiv.textContent = '?';
                    cardDiv.classList.add('hidden-card');
                }
                playerHand.appendChild(cardDiv);
            });
        }

        // Update played cards
        const playedCards = document.getElementById('played-cards');
        playedCards.innerHTML = '';
        this.currentSet.forEach(playedCard => {
            const cardDiv = document.createElement('div');
            cardDiv.className = `card ${playedCard.card.suit}`;
            cardDiv.textContent = new Card(playedCard.card.suit, playedCard.card.value).toString();
            playedCards.appendChild(cardDiv);
        });

        // Show/hide controls based on game phase
        const predictionControls = document.getElementById('prediction-controls');
        const trumpSelection = document.getElementById('trump-selection');

        predictionControls.classList.add('hidden');
        trumpSelection.classList.add('hidden');

        if (this.gamePhase === 'prediction' && this.currentPlayer === this.playerIndex) {
            predictionControls.classList.remove('hidden');
        } else if (this.gamePhase === 'trump' && this.currentPlayer === this.playerIndex) {
            trumpSelection.classList.remove('hidden');
        }
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
