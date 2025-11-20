const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const harperImage = new Image();
harperImage.src = 'harper-dog.png';

// Game Constants
const GRAVITY = 0.6;
const JUMP_FORCE = -12; // Initial velocity when jumping
const GROUND_HEIGHT = 50; // Height of the ground from bottom
const GAME_SPEED_INITIAL = 5;
const SPAWN_RATE_MIN = 1000; // ms
const SPAWN_RATE_MAX = 2500; // ms

// Game State
let isGameRunning = false;
let isGameOver = false;
let score = 0;
let startTime = 0;
let gameSpeed = GAME_SPEED_INITIAL;
let lastSpawnTime = 0;
let animationFrameId;
let obstacles = [];

// Dog (Player)
const dog = {
	x: 50,
	y: 0, // Will be set relative to ground
	width: 40,
	height: 40,
	velocityY: 0,
	velocityX: 0, // Horizontal velocity
	isJumping: false,
	color: '#00C3FF' // Harper Blue
};

// Input State
const keys = {
	ArrowUp: false,
	Space: false,
	ArrowLeft: false,
	ArrowRight: false
};

// Mobile Check
function isMobile() {
	return window.innerWidth <= 850;
}

// Obstacle Types
const obstacleTypes = [
	{ name: 'Turkey', color: '#8D6E63', width: 45, height: 45, label: '🦃' },
	{ name: 'Pie', color: '#E67E22', width: 45, height: 30, label: '🥧' },
	{ name: 'Corn', color: '#F1C40F', width: 30, height: 60, label: '🌽' },
	{ name: 'Leaves', color: '#D35400', width: 50, height: 50, label: '🍂' },
	{ name: 'Hat', color: '#2C3E50', width: 45, height: 45, label: '🎩' }
];

// DOM Elements
const scoreDisplay = document.getElementById('score-display');
const gameOverOverlay = document.getElementById('game-over-overlay');
const startOverlay = document.getElementById('start-overlay');
const finalScoreSpan = document.getElementById('final-score');
const playerNameInput = document.getElementById('player-name');
const submitScoreBtn = document.getElementById('submit-score-btn');
const playAgainBtn = document.getElementById('play-again-btn');
const submissionStatus = document.getElementById('submission-status');
const mobileControls = document.getElementById('mobile-controls');
const mobileJumpBtn = document.getElementById('mobile-jump-btn');

// Initialization
function init() {
	// Set initial dog position
	dog.y = canvas.height - GROUND_HEIGHT - dog.height;

	// Load leaderboards
	fetchLeaderboards();

	// Load saved name
	const savedName = localStorage.getItem('playerName');
	if (savedName) {
		playerNameInput.value = savedName;
	}

	// Event Listeners
	document.addEventListener('keydown', handleKeyDown);
	document.addEventListener('keyup', handleKeyUp);
	// document.addEventListener('touchstart', handleTouch); // Replaced by button
	document.getElementById('start-game-btn').addEventListener('click', startGame);
	submitScoreBtn.addEventListener('click', submitScore);
	playAgainBtn.addEventListener('click', resetGame);
	document.getElementById('my-history-btn').addEventListener('click', showPlayerHistory);

	// Mobile Controls
	mobileJumpBtn.addEventListener('touchstart', (e) => {
		e.preventDefault(); // Prevent mouse emulation
		handleMobileJump();
	});
	mobileJumpBtn.addEventListener('mousedown', (e) => {
		e.preventDefault();
		handleMobileJump();
	});

	// Resize listener
	window.addEventListener('resize', handleResize);
	handleResize(); // Initial check

	// Initial Draw
	draw();
}

function handleResize() {
	// Adjust canvas size logic if needed, but CSS handles display size.
	// We might want to reset dog position if it goes out of bounds on resize?
	// For now, just ensure mobile controls visibility is correct via CSS media queries.

	if (isMobile()) {
		mobileControls.classList.remove('hidden');
	} else {
		mobileControls.classList.add('hidden');
	}
}

async function showPlayerHistory() {
	const playerName = playerNameInput.value.trim() || localStorage.getItem('playerName');
	if (!playerName) {
		submissionStatus.textContent = 'Enter name first!';
		submissionStatus.style.color = 'red';
		return;
	}

	try {
		const res = await fetch(`/Game/player-runs?playerName=${encodeURIComponent(playerName)}&limit=10`);
		const runs = await res.json();
		renderPlayerHistory(runs);
		document.getElementById('player-history-section').classList.remove('hidden');
		// Scroll to history
		document.getElementById('player-history-section').scrollIntoView({ behavior: 'smooth' });
	} catch (error) {
		console.error(error);
	}
}

function renderPlayerHistory(runs) {
	const tbody = document.querySelector('#player-history-table tbody');
	tbody.innerHTML = '';

	runs.forEach(run => {
		const date = new Date(run.createdAt).toLocaleString();
		const tr = document.createElement('tr');
		tr.innerHTML = `
            <td>${date}</td>
            <td>${run.score}</td>
        `;
		tbody.appendChild(tr);
	});
}

function startGame() {
	if (isGameRunning) return;

	isGameRunning = true;
	isGameOver = false;
	score = 0;
	startTime = Date.now();
	lastSpawnTime = Date.now();
	obstacles = [];
	gameSpeed = GAME_SPEED_INITIAL;

	// Reset dog horizontal position
	dog.x = 50;

	startOverlay.classList.add('hidden');
	gameOverOverlay.classList.add('hidden');

	if (isMobile()) {
		mobileControls.classList.remove('hidden');
	}

	gameLoop();
}

function resetGame() {
	isGameRunning = false;
	isGameOver = false;
	score = 0;
	obstacles = [];
	dog.y = canvas.height - GROUND_HEIGHT - dog.height;
	dog.velocityY = 0;
	dog.x = 50;

	gameOverOverlay.classList.add('hidden');
	startOverlay.classList.remove('hidden');
	scoreDisplay.textContent = 'Score: 0';
	submissionStatus.textContent = '';

	// Hide mobile controls on reset (shown when game starts)
	// Actually keep them hidden until start
	mobileControls.classList.add('hidden');

	draw();
}

function handleKeyDown(e) {
	if (keys.hasOwnProperty(e.code)) {
		keys[e.code] = true;
	}

	if (['Space', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyD'].includes(e.code)) {
		e.preventDefault(); // Prevent scrolling
		if (!isGameRunning && !isGameOver && !startOverlay.classList.contains('hidden')) {
			startGame();
		} else if (isGameRunning) {
			if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
				jump();
			}
		}
	}
}

function handleKeyUp(e) {
	if (keys.hasOwnProperty(e.code)) {
		keys[e.code] = false;
	}
}

function handleMobileJump() {
	if (!isGameRunning && !isGameOver && !startOverlay.classList.contains('hidden')) {
		startGame();
	} else if (isGameRunning) {
		jump();
	}
}

function jump() {
	if (!dog.isJumping) {
		dog.velocityY = JUMP_FORCE;
		dog.isJumping = true;
	}
}

function spawnObstacle() {
	const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
	const obstacle = {
		x: canvas.width,
		y: canvas.height - GROUND_HEIGHT - type.height,
		width: type.width,
		height: type.height,
		color: type.color,
		label: type.label,
		passed: false
	};
	obstacles.push(obstacle);
}

function update() {
	// Update Score
	const elapsed = (Date.now() - startTime) / 1000;
	score = Math.floor(elapsed);
	scoreDisplay.textContent = `Score: ${score}`;

	// Increase speed slightly over time
	gameSpeed = GAME_SPEED_INITIAL + (score / 10);

	// Dog Physics
	dog.velocityY += GRAVITY;
	dog.y += dog.velocityY;

	// Horizontal Movement (Keyboard)
	const moveSpeed = 5;
	if (keys.ArrowLeft || keys.KeyA) {
		dog.x -= moveSpeed;
	}
	if (keys.ArrowRight || keys.KeyD) {
		dog.x += moveSpeed;
	}

	// Boundaries
	if (dog.x < 0) dog.x = 0;
	if (dog.x + dog.width > canvas.width) dog.x = canvas.width - dog.width;

	// Ground Collision
	if (dog.y > canvas.height - GROUND_HEIGHT - dog.height) {
		dog.y = canvas.height - GROUND_HEIGHT - dog.height;
		dog.velocityY = 0;
		dog.isJumping = false;
	}

	// Obstacle Spawning
	const now = Date.now();
	if (now - lastSpawnTime > Math.random() * (SPAWN_RATE_MAX - SPAWN_RATE_MIN) + SPAWN_RATE_MIN) {
		spawnObstacle();
		lastSpawnTime = now;
	}

	// Update Obstacles
	for (let i = obstacles.length - 1; i >= 0; i--) {
		const obs = obstacles[i];
		obs.x -= gameSpeed;

		// Remove off-screen obstacles
		if (obs.x + obs.width < 0) {
			obstacles.splice(i, 1);
			continue;
		}

		// Collision Detection
		// Tighter hitbox: require visual overlap
		const hitPadding = 10; // Pixels to shrink the hitbox by on each side

		if (
			dog.x + hitPadding < obs.x + obs.width - hitPadding &&
			dog.x + dog.width - hitPadding > obs.x + hitPadding &&
			dog.y + hitPadding < obs.y + obs.height - hitPadding &&
			dog.y + dog.height - hitPadding > obs.y + hitPadding
		) {
			gameOver();
		}
	}
}

function draw() {
	// Clear Canvas
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	// Draw Ground
	ctx.fillStyle = '#8D6E63';
	ctx.fillRect(0, canvas.height - GROUND_HEIGHT, canvas.width, GROUND_HEIGHT);

	// Draw Grass Line
	ctx.fillStyle = '#2E7D32';
	ctx.fillRect(0, canvas.height - GROUND_HEIGHT, canvas.width, 10);

	// Draw Dog
	if (harperImage.complete) {
		ctx.drawImage(harperImage, dog.x, dog.y, dog.width, dog.height);
	} else {
		// Fallback if image not loaded yet
		ctx.fillStyle = dog.color;
		ctx.fillRect(dog.x, dog.y, dog.width, dog.height);
	}

	// Draw Obstacles
	for (const obs of obstacles) {
		// No background box, just the emoji
		// ctx.fillStyle = obs.color;
		// ctx.fillRect(obs.x, obs.y, obs.width, obs.height);

		// Draw Label (Emoji) - Make it bigger
		ctx.font = '40px Arial'; // Bigger font
		ctx.textAlign = 'center';
		// Adjust text position to be centered in the hitbox
		ctx.fillText(obs.label, obs.x + obs.width / 2, obs.y + obs.height - 5);

		// Debug hitbox (optional, commented out)
		// ctx.strokeStyle = 'red';
		// ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
	}
}

function gameLoop() {
	if (!isGameRunning) return;

	update();
	draw();

	if (!isGameOver) {
		animationFrameId = requestAnimationFrame(gameLoop);
	}
}

function gameOver() {
	isGameRunning = false;
	isGameOver = true;
	cancelAnimationFrame(animationFrameId);

	finalScoreSpan.textContent = score;
	gameOverOverlay.classList.remove('hidden');
	mobileControls.classList.add('hidden'); // Hide jump button on game over
}

// API Integration

async function submitScore() {
	const playerName = playerNameInput.value.trim();
	if (!playerName) {
		submissionStatus.textContent = 'Please enter a name!';
		submissionStatus.style.color = 'red';
		return;
	}

	localStorage.setItem('playerName', playerName);
	submissionStatus.textContent = 'Submitting...';
	submissionStatus.style.color = 'white';
	submitScoreBtn.disabled = true;

	try {
		const response = await fetch('/Game/submit-run', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				playerName,
				score,
				durationSeconds: score // Using score as duration for simplicity
			})
		});

		if (response.ok) {
			submissionStatus.textContent = 'Score submitted!';
			submissionStatus.style.color = '#4CAF50';
			fetchLeaderboards(); // Refresh leaderboards
		} else {
			throw new Error('Submission failed');
		}
	} catch (error) {
		console.error(error);
		submissionStatus.textContent = 'Error submitting score.';
		submissionStatus.style.color = 'red';
	} finally {
		submitScoreBtn.disabled = false;
	}
}

async function fetchLeaderboards() {
	try {
		// Top Runs
		const topRunsRes = await fetch('/Game/top-runs?limit=10');
		const topRuns = await topRunsRes.json();
		renderTopRuns(topRuns);

		// Cumulative Leaderboard
		const cumulativeRes = await fetch('/Game/leaderboard-cumulative?limit=10');
		const cumulative = await cumulativeRes.json();
		renderCumulative(cumulative);

	} catch (error) {
		console.error('Error fetching leaderboards:', error);
	}
}

function renderTopRuns(runs) {
	const tbody = document.querySelector('#top-runs-table tbody');
	tbody.innerHTML = '';

	runs.forEach((run, index) => {
		const tr = document.createElement('tr');
		tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${escapeHtml(run.playerName)}</td>
            <td>${run.score}</td>
        `;
		tbody.appendChild(tr);
	});
}

function renderCumulative(players) {
	const tbody = document.querySelector('#cumulative-table tbody');
	tbody.innerHTML = '';

	players.forEach((player, index) => {
		const tr = document.createElement('tr');
		tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${escapeHtml(player.playerName)}</td>
            <td>${player.totalScore}</td>
            <td>${player.runCount}</td>
        `;
		tbody.appendChild(tr);
	});
}

function escapeHtml(text) {
	if (!text) return '';
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

// Start
init();
