# Sets Card Game

A multiplayer card game where players predict and win sets based on trump suits.

## Game Rules

### Setup
- 4 players: Use all 52 cards (13 cards each)
- 5 players: Discard two 2s (50 cards, 10 each)
- 6 players: Discard all 2s (48 cards, 8 each)

### Gameplay
1. Each player sees only 4 random cards initially
2. Players predict how many sets they'll win
3. Highest predictor picks trump suit
4. All cards become visible after trump is set
5. Winner of each set leads the next one

### Scoring
- Correct prediction: 10 points + number of sets won
- Incorrect prediction: 0 points

### Special Rules
- Must follow suit if possible
- Trump cards win over other suits
- Total predictions cannot equal total possible sets

## How to Play

1. Enter your name and either:
   - Create a new room
   - Join an existing room with a room code
2. Share your room code with friends
3. Host can start the game when enough players join
4. Make predictions and play your cards when it's your turn

## Development

### Local Setup
1. Clone the repository
2. Install dependencies:
   ```bash
   cd server
   npm install
   ```
3. Start the server:
   ```bash
   node server.js
   ```
4. Open `frontend/index.html` in your browser

### Technologies Used
- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express, Socket.IO
