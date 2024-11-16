const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        allowedHeaders: ["*"],
        credentials: true
    }
});
const cors = require('cors');

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.get('/', (req, res) => {
    res.send('Sets Game Server is running!');
});

const rooms = new Map();

function generateDeck(numPlayers) {
    const deck = [];
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const values = Array.from({length: 13}, (_, i) => i + 2); // 2 to 14 (Ace)

    // Remove appropriate 2s based on number of players
    if (numPlayers === 5) {
        // Remove two 2s (one black, one red)
        values.shift(); // Remove first 2
        suits.forEach(suit => {
            if (suit !== 'hearts' && suit !== 'diamonds') { // Only for black suits
                for (let value of values) {
                    deck.push({ suit, value });
                }
            } else {
                for (let value of values.slice(1)) { // Skip the 2 for red suits
                    deck.push({ suit, value });
                }
            }
        });
    } else if (numPlayers === 6) {
        // Remove all 2s
        values.shift();
        suits.forEach(suit => {
            for (let value of values) {
                deck.push({ suit, value });
            }
        });
    } else {
        // Use all cards for 4 players
        suits.forEach(suit => {
            for (let value of values) {
                deck.push({ suit, value });
            }
        });
    }

    return deck;
}

function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function dealCards(deck, numPlayers) {
    const hands = {};
    const cardsPerPlayer = Math.floor(deck.length / numPlayers);
    
    for (let i = 0; i < numPlayers; i++) {
        const start = i * cardsPerPlayer;
        const end = start + cardsPerPlayer;
        hands[i] = deck.slice(start, end);
    }
    
    return hands;
}

function createGameState(numPlayers) {
    return {
        round: 1,
        currentPlayer: 0,
        trumpSuit: null,
        predictions: {},
        setsWon: {},
        scores: {},
        currentSet: [],
        hands: {},
        visibleCards: {},
        gamePhase: 'preview'
    };
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('createRoom', (playerName) => {
        const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        rooms.set(roomCode, {
            players: [{id: socket.id, name: playerName, isHost: true}],
            gameState: null,
            settings: null
        });
        socket.join(roomCode);
        socket.emit('roomCreated', roomCode);
        io.to(roomCode).emit('playersUpdate', rooms.get(roomCode).players);
    });

    socket.on('joinRoom', ({roomCode, playerName}) => {
        const room = rooms.get(roomCode);
        if (!room) {
            socket.emit('error', 'Room not found');
            return;
        }
        if (room.players.length >= 6) {
            socket.emit('error', 'Room is full');
            return;
        }
        room.players.push({id: socket.id, name: playerName, isHost: false});
        socket.join(roomCode);
        socket.emit('roomJoined', roomCode);
        io.to(roomCode).emit('playersUpdate', room.players);
    });

    socket.on('startGame', ({roomCode, settings}) => {
        const room = rooms.get(roomCode);
        if (!room) return;
        
        const player = room.players.find(p => p.id === socket.id);
        if (!player || !player.isHost) return;

        console.log('Starting game with settings:', settings);

        // Initialize game state
        room.settings = settings;
        room.gameState = createGameState(room.players.length);
        room.gameState.gamePhase = 'prediction';
        room.gameState.players = room.players;
        room.gameState.currentPlayer = 0;

        // Generate and shuffle deck
        const deck = shuffleDeck(generateDeck(room.players.length));
        console.log('Generated deck:', deck.length, 'cards');

        // Deal cards to each player
        const hands = dealCards(deck, room.players.length);
        room.players.forEach((player, index) => {
            room.gameState.hands[player.id] = hands[index];
            
            // Select 4 random cards to be visible initially
            const visibleIndices = new Set();
            while (visibleIndices.size < 4) {
                visibleIndices.add(Math.floor(Math.random() * hands[index].length));
            }
            room.gameState.visibleCards[player.id] = Array.from(visibleIndices);
        });

        console.log('Dealt cards to players:', {
            numPlayers: room.players.length,
            handsDealt: Object.keys(room.gameState.hands).length,
            cardsPerHand: Object.values(room.gameState.hands)[0].length,
            gamePhase: room.gameState.gamePhase,
            currentPlayer: room.gameState.currentPlayer
        });

        // Send game state to each player
        room.players.forEach((player, index) => {
            io.to(player.id).emit('gameStarted', {
                ...room.gameState,
                playerIndex: index,
                visibleCards: room.gameState.visibleCards[player.id]
            });
        });
    });

    socket.on('gameAction', ({roomCode, action, data}) => {
        const room = rooms.get(roomCode);
        if (!room || !room.gameState) return;

        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex === -1 || playerIndex !== room.gameState.currentPlayer) return;

        switch(action) {
            case 'makePrediction':
                room.gameState.predictions[socket.id] = data.prediction;
                if (Object.keys(room.gameState.predictions).length === room.players.length) {
                    room.gameState.gamePhase = 'trump';
                    // Find highest predictor
                    let maxPrediction = -1;
                    let maxPredictor = 0;
                    room.players.forEach((player, index) => {
                        const prediction = room.gameState.predictions[player.id];
                        if (prediction > maxPrediction) {
                            maxPrediction = prediction;
                            maxPredictor = index;
                        }
                    });
                    room.gameState.currentPlayer = maxPredictor;
                } else {
                    room.gameState.currentPlayer = (playerIndex + 1) % room.players.length;
                }
                break;

            case 'setTrump':
                room.gameState.trumpSuit = data.trumpSuit;
                room.gameState.gamePhase = 'play';
                // Make all cards visible for all players
                room.players.forEach(player => {
                    room.gameState.visibleCards[player.id] = Array.from(
                        { length: room.gameState.hands[player.id].length }, 
                        (_, i) => i
                    );
                });
                break;

            case 'playCard':
                const card = room.gameState.hands[socket.id][data.cardIndex];
                room.gameState.currentSet.push({
                    playerId: socket.id,
                    card: card
                });
                // Remove card from hand
                room.gameState.hands[socket.id].splice(data.cardIndex, 1);
                // Update visible cards array
                room.gameState.visibleCards[socket.id] = room.gameState.visibleCards[socket.id]
                    .filter(i => i !== data.cardIndex)
                    .map(i => i > data.cardIndex ? i - 1 : i);

                if (room.gameState.currentSet.length === room.players.length) {
                    // Determine winner of the set
                    let winningCard = room.gameState.currentSet[0];
                    for (let i = 1; i < room.gameState.currentSet.length; i++) {
                        const currentCard = room.gameState.currentSet[i];
                        if (currentCard.card.suit === room.gameState.trumpSuit && 
                            winningCard.card.suit !== room.gameState.trumpSuit) {
                            winningCard = currentCard;
                        } else if (currentCard.card.suit === winningCard.card.suit && 
                                 currentCard.card.value > winningCard.card.value) {
                            winningCard = currentCard;
                        }
                    }
                    
                    // Update scores
                    const winner = room.players.findIndex(p => p.id === winningCard.playerId);
                    room.gameState.setsWon[winningCard.playerId] = 
                        (room.gameState.setsWon[winningCard.playerId] || 0) + 1;
                    room.gameState.currentPlayer = winner;
                    room.gameState.currentSet = [];
                } else {
                    room.gameState.currentPlayer = (playerIndex + 1) % room.players.length;
                }
                break;
        }

        // Send updated state to each player
        room.players.forEach((player) => {
            io.to(player.id).emit('gameStateUpdate', {
                ...room.gameState,
                playerIndex: room.players.findIndex(p => p.id === player.id),
                visibleCards: room.gameState.visibleCards[player.id]
            });
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        rooms.forEach((room, roomCode) => {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                if (room.players.length === 0) {
                    rooms.delete(roomCode);
                } else {
                    if (playerIndex === 0) {
                        room.players[0].isHost = true;
                    }
                    io.to(roomCode).emit('playersUpdate', room.players);
                }
            }
        });
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
