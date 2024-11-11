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
        room.gameState.gamePhase = 'prediction';
        
        // Deal initial cards
        const numPlayers = room.players.length;
        const cardsPerPlayer = numPlayers === 4 ? 13 : (numPlayers === 5 ? 10 : 8);
        
        room.players.forEach((player, index) => {
            room.gameState.hands[player.id] = Array(cardsPerPlayer).fill(null).map(() => ({
                suit: ['hearts', 'diamonds', 'clubs', 'spades'][Math.floor(Math.random() * 4)],
                value: Math.floor(Math.random() * 13) + 2
            }));
        });

        io.to(roomCode).emit('gameStarted', {
            ...room.gameState,
            playerIndex: room.players.findIndex(p => p.id === socket.id)
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
                // Show all cards to all players
                break;

            case 'playCard':
                const card = room.gameState.hands[socket.id][data.cardIndex];
                room.gameState.currentSet.push({
                    playerId: socket.id,
                    card: card
                });
                // Remove card from hand
                room.gameState.hands[socket.id].splice(data.cardIndex, 1);

                if (room.gameState.currentSet.length === room.players.length) {
                    // Determine winner of the set
                    // ... (implement set winner logic)
                    room.gameState.currentSet = [];
                } else {
                    room.gameState.currentPlayer = (playerIndex + 1) % room.players.length;
                }
                break;
        }

        io.to(roomCode).emit('gameStateUpdate', {
            ...room.gameState,
            playerIndex: room.players.findIndex(p => p.id === socket.id)
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
