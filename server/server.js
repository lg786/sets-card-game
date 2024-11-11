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
        room.gameState = {
            round: 1,
            currentPlayer: 0,
            trumpSuit: null,
            predictions: {},
            setsWon: {},
            scores: {},
            currentSet: []
        };
        io.to(roomCode).emit('gameStarted', room.gameState);
    });

    socket.on('gameAction', ({roomCode, action, data}) => {
        const room = rooms.get(roomCode);
        if (!room || !room.gameState) return;

        switch(action) {
            case 'makePrediction':
                room.gameState.predictions[socket.id] = data.prediction;
                io.to(roomCode).emit('gameStateUpdate', room.gameState);
                break;
            case 'setTrump':
                room.gameState.trumpSuit = data.trumpSuit;
                io.to(roomCode).emit('gameStateUpdate', room.gameState);
                break;
            case 'playCard':
                room.gameState.currentSet.push({
                    playerId: socket.id,
                    card: data.card
                });
                io.to(roomCode).emit('gameStateUpdate', room.gameState);
                break;
        }
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
