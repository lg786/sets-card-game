// Connect to the server
const socket = io(CONFIG.SERVER_URL);

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

// Event Listeners
createRoomBtn.addEventListener('click', () => {
    playerName = playerNameInput.value.trim();
    if (!playerName) {
        alert('Please enter your name');
        return;
    }
    socket.emit('createRoom', playerName);
});

joinRoomBtn.addEventListener('click', () => {
    playerName = playerNameInput.value.trim();
    const roomCode = roomCodeInput.value.trim().toUpperCase();
    if (!playerName || !roomCode) {
        alert('Please enter your name and room code');
        return;
    }
    socket.emit('joinRoom', {roomCode, playerName});
});

startGameBtn.addEventListener('click', () => {
    if (!isHost) return;
    const numPlayers = parseInt(document.getElementById('num-players').value);
    socket.emit('startGame', {
        roomCode: currentRoom,
        settings: {
            numPlayers
        }
    });
});

// Socket event handlers
socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('roomCreated', (roomCode) => {
    currentRoom = roomCode;
    isHost = true;
    showWaitingRoom();
});

socket.on('roomJoined', (roomCode) => {
    currentRoom = roomCode;
    showWaitingRoom();
});

socket.on('error', (message) => {
    alert(message);
});

socket.on('playersUpdate', (players) => {
    updatePlayersList(players);
    if (isHost) {
        startGameBtn.disabled = players.length < 4;
    }
});

socket.on('gameStarted', (gameState) => {
    showGameScreen();
    // Initialize game with gameState
    game.initializeFromState(gameState);
});

socket.on('gameStateUpdate', (gameState) => {
    // Update game with new state
    game.updateFromState(gameState);
});

// UI Functions
function showWaitingRoom() {
    loginScreen.classList.add('hidden');
    waitingScreen.classList.remove('hidden');
    gameScreen.classList.add('hidden');
    currentRoomCode.textContent = currentRoom;
    if (isHost) {
        hostControls.classList.remove('hidden');
    }
}

function showGameScreen() {
    loginScreen.classList.add('hidden');
    waitingScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
}

function updatePlayersList(players) {
    waitingPlayers.innerHTML = '';
    players.forEach(player => {
        const li = document.createElement('li');
        li.textContent = `${player.name}${player.isHost ? ' (Host)' : ''}`;
        waitingPlayers.appendChild(li);
    });
}
