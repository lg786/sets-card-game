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
        this.gamePhase = 'preview'; // 'preview', 'prediction', 'trump', 'play'
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
            this.showInitialCards(i);
        }
    }

    showInitialCards(playerIndex) {
        const player = this.players[playerIndex];
        player.visibleCardIndices.clear();
        while (player.visibleCardIndices.size < 4) {
            player.visibleCardIndices.add(Math.floor(Math.random() * player.hand.length));
        }
    }

    getTotalPossibleSets() {
        // Calculate total possible sets based on number of cards per player
        return this.players[0].hand.length;
    }

    getCurrentTotalPredictions() {
        return this.players.reduce((sum, player) => 
            sum + (player.prediction !== null ? player.prediction : 0), 0);
    }

    isValidPrediction(playerIndex, prediction) {
        const totalSets = this.getTotalPossibleSets();
        const currentTotal = this.getCurrentTotalPredictions();
        const isLastPlayer = playerIndex === this.players.length - 1;

        // Basic validation
        if (prediction < 0 || prediction > totalSets) {
            return {
                valid: false,
                message: `Prediction must be between 0 and ${totalSets}`
            };
        }

        // Special rule for last player
        if (isLastPlayer && (currentTotal + prediction === totalSets)) {
            return {
                valid: false,
                message: `Last player's prediction cannot make total equal ${totalSets}`
            };
        }

        return { valid: true };
    }

    submitPrediction(playerIndex, prediction) {
        const validationResult = this.isValidPrediction(playerIndex, prediction);
        if (!validationResult.valid) {
            return validationResult;
        }

        this.players[playerIndex].prediction = prediction;
        this.currentPlayer = (playerIndex + 1) % this.players.length;
        
        if (this.players.every(p => p.prediction !== null)) {
            this.predictionsSubmitted = true;
            this.findHighestPrediction();
            this.gamePhase = 'trump';
        }

        return { valid: true };
    }

    findHighestPrediction() {
        let maxPrediction = -1;
        let maxPlayer = -1;
        this.players.forEach((player, index) => {
            if (player.prediction > maxPrediction) {
                maxPrediction = player.prediction;
                maxPlayer = index;
            }
        });
        this.currentPlayer = maxPlayer;
    }

    setTrump(suit) {
        this.trumpSuit = suit;
        this.trumpSelected = true;
        this.gamePhase = 'play';
        // After trump is selected, show all cards to all players
        this.players.forEach(player => {
            player.visibleCardIndices.clear();
            for (let i = 0; i < player.hand.length; i++) {
                player.visibleCardIndices.add(i);
            }
        });
    }

    playCard(playerIndex, cardIndex) {
        if (this.gamePhase !== 'play' || playerIndex !== this.currentPlayer) return false;
        
        const player = this.players[playerIndex];
        const card = player.hand[cardIndex];

        // Check if player must follow suit
        if (this.leadingSuit && player.hand.some(c => c.suit === this.leadingSuit)) {
            if (card.suit !== this.leadingSuit) return false;
        }

        // Play the card
        this.currentSet.push({
            card: card,
            playerIndex: playerIndex
        });
        player.hand.splice(cardIndex, 1);
        player.visibleCardIndices.delete(cardIndex);
        // Adjust remaining visible card indices
        const newVisibleIndices = new Set();
        player.visibleCardIndices.forEach(index => {
            if (index < cardIndex) {
                newVisibleIndices.add(index);
            } else if (index > cardIndex) {
                newVisibleIndices.add(index - 1);
            }
        });
        player.visibleCardIndices = newVisibleIndices;

        // Set leading suit if first card
        if (this.currentSet.length === 1) {
            this.leadingSuit = card.suit;
        }

        // If all players have played, determine winner
        if (this.currentSet.length === this.players.length) {
            this.determineSetWinner();
        } else {
            this.currentPlayer = (this.currentPlayer + 1) % this.players.length;
        }

        return true;
    }

    determineSetWinner() {
        let winningCard = this.currentSet[0];
        for (let i = 1; i < this.currentSet.length; i++) {
            const currentCard = this.currentSet[i];
            if (currentCard.card.suit === this.trumpSuit && winningCard.card.suit !== this.trumpSuit) {
                winningCard = currentCard;
            } else if (currentCard.card.suit === winningCard.card.suit && 
                      currentCard.card.value > winningCard.card.value) {
                winningCard = currentCard;
            }
        }

        const winner = winningCard.playerIndex;
        this.players[winner].setsWon++;
        this.currentPlayer = winner;
        this.currentSet = [];
        this.leadingSuit = null;

        // Check if round is over
        if (this.players[0].hand.length === 0) {
            this.endRound();
        }
    }

    endRound() {
        // Calculate scores
        this.players.forEach(player => {
            if (player.setsWon === player.prediction) {
                player.score += 10 + player.prediction;
            }
            player.setsWon = 0;
            player.prediction = null;
        });

        this.currentRound++;
        this.trumpSuit = null;
        this.predictionsSubmitted = false;
        this.trumpSelected = false;
        this.gamePhase = 'preview';

        if (this.currentRound <= this.players.length) {
            this.startNewRound();
        } else {
            this.endGame();
        }
    }

    startNewRound() {
        this.initializeDeck();
        this.shuffleDeck();
        this.dealCards();
    }

    endGame() {
        this.gamePhase = 'end';
        console.log("Game Over!");
    }
}

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
