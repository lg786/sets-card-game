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

// Basic route to verify server is running
app.get('/', (req, res) => {
    res.send('Sets Game Server is running!');
});

const rooms = new Map();

function createGameState(numPlayers) {
    return {
        round: 1,
        currentPlayer: 0,
        trumpSuit: null,
        predictions: {},
        setsWon: {},
        scores: {},
        currentSet: [],
        deck: [],
        hands: {},
        visibleCards: {}, // Track which cards are visible for each player
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

        room.settings = settings;
        room.gameState = createGameState(room.players.length);
        room.gameState.gamePhase = 'preview';
        room.gameState.players = room.players;
        
        // Deal initial cards
        const numPlayers = room.players.length;
        const cardsPerPlayer = numPlayers === 4 ? 13 : (numPlayers === 5 ? 10 : 8);
        
        room.players.forEach((player) => {
            // Deal cards
            room.gameState.hands[player.id] = Array(cardsPerPlayer).fill(null).map(() => ({
                suit: ['hearts', 'diamonds', 'clubs', 'spades'][Math.floor(Math.random() * 4)],
                value: Math.floor(Math.random() * 13) + 2
            }));

            // Select 4 random cards to be visible initially
            const visibleIndices = new Set();
            while (visibleIndices.size < 4) {
                visibleIndices.add(Math.floor(Math.random() * cardsPerPlayer));
            }
            room.gameState.visibleCards[player.id] = Array.from(visibleIndices);
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
                    // ... (implement set winner logic)
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
