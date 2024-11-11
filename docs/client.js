// Connect to the server
const socket = io(CONFIG.SERVER_URL, {
    reconnectionDelay: 1000,
    reconnection: true,
    reconnectionAttempts: 10,
    transports: ['websocket'],
    agent: false,
    upgrade: false,
    rejectUnauthorized: false
});

// Game state
let currentRoom = null;
let playerName = null;
let isHost = false;

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const waitingScreen = document.getElementById('waiting-screen');
const gameScreen = document.getElementById('game-screen');
const playerNameInput = document.getElementById('player-name');
const roomCodeInput = document.getElementById('room-code');
const createRoomBtn = document.getElementById('create-room');
const joinRoomBtn = document.getElementById('join-room');
const currentRoomCode = document.getElementById('current-room-code');
const waitingPlayers = document.getElementById('waiting-players');
const hostControls = document.getElementById('host-controls');
const startGameBtn = document.getElementById('start-game');

// Socket connection status
socket.on('connect_error', (error) => {
    console.error('Connection Error:', error);
    alert('Failed to connect to server. Please try again.');
});

socket.on('connect', () => {
    console.log('Connected to server successfully!');
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

// Event Listeners
createRoomBtn.addEventListener('click', () => {
    console.log('Create room button clicked');
    playerName = playerNameInput.value.trim();
    if (!playerName) {
        alert('Please enter your name');
        return;
    }
    console.log('Emitting createRoom event with name:', playerName);
    socket.emit('createRoom', playerName);
});

joinRoomBtn.addEventListener('click', () => {
    console.log('Join room button clicked');
    playerName = playerNameInput.value.trim();
    const roomCode = roomCodeInput.value.trim().toUpperCase();
    if (!playerName || !roomCode) {
        alert('Please enter your name and room code');
        return;
    }
    console.log('Emitting joinRoom event with:', { roomCode, playerName });
    socket.emit('joinRoom', {roomCode, playerName});
});

startGameBtn.addEventListener('click', () => {
    if (!isHost) return;
    const numPlayers = parseInt(document.getElementById('num-players').value);
    console.log('Emitting startGame event:', { roomCode: currentRoom, settings: { numPlayers } });
    socket.emit('startGame', {
        roomCode: currentRoom,
        settings: {
            numPlayers
        }
    });
});

// Socket event handlers
socket.on('roomCreated', (roomCode) => {
    console.log('Room created:', roomCode);
    currentRoom = roomCode;
    isHost = true;
    showWaitingRoom();
});

socket.on('roomJoined', (roomCode) => {
    console.log('Room joined:', roomCode);
    currentRoom = roomCode;
    showWaitingRoom();
});

socket.on('error', (message) => {
    console.error('Server error:', message);
    alert(message);
});

socket.on('playersUpdate', (players) => {
    console.log('Players update:', players);
    updatePlayersList(players);
    if (isHost) {
        startGameBtn.disabled = players.length < 4;
    }
});

socket.on('gameStarted', (gameState) => {
    console.log('Game started:', gameState);
    showGameScreen();
    // Initialize game with gameState
    game.initializeFromState(gameState);
});

socket.on('gameStateUpdate', (gameState) => {
    console.log('Game state update:', gameState);
    // Update game with new state
    game.updateFromState(gameState);
});

// UI Functions
function showWaitingRoom() {
    console.log('Showing waiting room');
    loginScreen.classList.add('hidden');
    waitingScreen.classList.remove('hidden');
    gameScreen.classList.add('hidden');
    currentRoomCode.textContent = currentRoom;
    if (isHost) {
        hostControls.classList.remove('hidden');
    }
}

function showGameScreen() {
    console.log('Showing game screen');
    loginScreen.classList.add('hidden');
    waitingScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
}

function updatePlayersList(players) {
    console.log('Updating players list:', players);
    waitingPlayers.innerHTML = '';
    players.forEach(player => {
        const li = document.createElement('li');
        li.textContent = `${player.name}${player.isHost ? ' (Host)' : ''}`;
        waitingPlayers.appendChild(li);
    });
}
