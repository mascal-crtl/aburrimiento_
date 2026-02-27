// ─── GLOBAL STATE ───────────────────────────────────────────────────────────
let currentGame = 'snake';
let gameScore = 0;
let totalScore = 0;
let animFrame = null;
let gameRunning = false;
let gamePaused = false;

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// ─── GAME CONFIGS ────────────────────────────────────────────────────────────
const GAMES = {
  snake:    { title: 'SNAKE',    color: '#06d6a0', desc: 'Usa las flechas del teclado para mover la serpiente.<br>Come las manzanas para crecer y no chocques con las paredes.', keys: '<kbd>↑↓←→</kbd> Mover', w: 480, h: 480 },
  tetris:   { title: 'TETRIS',   color: '#ffd166', desc: 'Usa las flechas para mover y rotar los bloques.<br>Completa filas horizontales para eliminarlas.', keys: '<kbd>↑</kbd> Rotar &nbsp; <kbd>←→</kbd> Mover &nbsp; <kbd>↓</kbd> Bajar', w: 320, h: 480 },
  pong:     { title: 'PONG',     color: '#118ab2', desc: 'Usa W/S o las flechas para mover tu paleta.<br>Evita que la bola pase tu paleta.', keys: '<kbd>W/S</kbd> o <kbd>↑↓</kbd> Mover paleta', w: 600, h: 400 },
  breakout: { title: 'BREAKOUT', color: '#ff6b6b', desc: 'Usa las flechas o el mouse para mover la paleta.<br>Rompe todos los bloques con la bola.', keys: '<kbd>←→</kbd> o Mouse para mover', w: 480, h: 480 },
  memory:   { title: 'MEMORY',   color: '#a56eff', desc: 'Haz clic en las cartas para voltearlas.<br>Encuentra todos los pares iguales.', keys: '<kbd>Click</kbd> para voltear carta', w: 480, h: 480 },
};

// ─── SWITCH GAME ─────────────────────────────────────────────────────────────
function switchGame(name) {
  stopCurrentGame();
  
  // Update sidebar cards
  document.querySelectorAll('.game-card').forEach(c => c.classList.remove('active'));
  document.getElementById('card-' + name).classList.add('active');
  
  // Update old active status
  if (currentGame) {
    const oldStatus = document.getElementById('status-' + currentGame);
    if (oldStatus) oldStatus.textContent = '';
  }
  document.getElementById('status-' + name).textContent = 'EN CURSO';
  
  currentGame = name;
  const g = GAMES[name];
  
  // Resize canvas
  canvas.width = g.w;
  canvas.height = g.h;
  
  // Show/hide memory div
  const memDiv = document.getElementById('memory-container');
  const canvasWrap = document.getElementById('canvas-wrap');
  if (name === 'memory') {
    canvasWrap.style.display = 'none';
    memDiv.style.display = 'block';
    memDiv.style.width = g.w + 'px';
    memDiv.style.minHeight = g.h + 'px';
  } else {
    canvasWrap.style.display = 'flex';
    memDiv.style.display = 'none';
  }
  
  // Update UI
  document.getElementById('frame-title').textContent = g.title;
  document.getElementById('frame-title').style.color = g.color;
  document.getElementById('overlay-title').textContent = g.title;
  document.getElementById('overlay-title').style.color = g.color;
  document.getElementById('overlay-desc').innerHTML = g.desc;
  document.getElementById('info-extra').querySelector('strong') && (document.getElementById('score-display').textContent = '0');
  
  // Update key hints
  document.querySelector('.info-bar').innerHTML = `
    <div class="key-hint">${g.keys}</div>
    <div class="key-hint"><kbd>P</kbd> Pausar</div>
    <div class="key-hint"><kbd>R</kbd> Reiniciar</div>
    <div class="info-right">Nivel: <strong id="level-display">1</strong></div>
  `;
  
  showOverlay();
  gameScore = 0;
  updateScore(0);
}

function showOverlay() {
  document.getElementById('game-overlay').style.display = 'flex';
  gameRunning = false;
}

function hideOverlay() {
  document.getElementById('game-overlay').style.display = 'none';
}

function updateScore(s) {
  gameScore = s;
  document.getElementById('score-display').textContent = s;
}

function startCurrentGame() {
  hideOverlay();
  gameRunning = true;
  gamePaused = false;
  switch (currentGame) {
    case 'snake':    initSnake();    break;
    case 'tetris':   initTetris();   break;
    case 'pong':     initPong();     break;
    case 'breakout': initBreakout(); break;
    case 'memory':   initMemory();   break;
  }
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
  setTimeout(createTouchPad, 100);
}
}

function stopCurrentGame() {
  if (animFrame) cancelAnimationFrame(animFrame);
  animFrame = null;
  gameRunning = false;
}

function gameOver(msg = 'GAME OVER', score = gameScore) {
  stopCurrentGame();
  totalScore += score;
  document.getElementById('total-score').textContent = totalScore;
  document.getElementById('overlay-title').textContent = msg;
  document.getElementById('overlay-desc').innerHTML = `Puntuación: <span style="color:var(--accent2);font-family:'Press Start 2P',monospace">${score}</span><br><br>¡Inténtalo de nuevo!`;
  document.getElementById('btn-start').textContent = '↺ REINICIAR';
  showOverlay();
  removeTouchPad();
}

// ─── KEY HANDLING ─────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'p' || e.key === 'P') {
    if (!gameRunning && !gamePaused) return;
    gamePaused = !gamePaused;
    if (!gamePaused && currentGame !== 'memory') {
      switch (currentGame) {
        case 'snake':    snakeLoop();    break;
        case 'tetris':   tetrisLoop();   break;
        case 'pong':     pongLoop();     break;
        case 'breakout': breakoutLoop(); break;
      }
    }
  }
  if (e.key === 'r' || e.key === 'R') {
    if (gameRunning || gamePaused) {
      stopCurrentGame();
      startCurrentGame();
    }
  }
  // Pass keys to games
  if (currentGame === 'snake') snakeKey(e);
  if (currentGame === 'tetris') tetrisKey(e);
  if (currentGame === 'pong') pongKey(e);
  if (currentGame === 'breakout') breakoutKey(e);
});

//   SNAKE  

let snake, snakeDir, snakeFood, snakeTimer, snakeSpeed, snakeGrow;
const SZ = 20; // cell size

function initSnake() {
  const cols = canvas.width / SZ;
  const rows = canvas.height / SZ;
  snake = [{ x: Math.floor(cols/2), y: Math.floor(rows/2) }];
  snakeDir = { x: 1, y: 0 };
  snakeNextDir = { x: 1, y: 0 };
  snakeFood = randomFood();
  snakeGrow = 0;
  snakeSpeed = 150;
  updateScore(0);
  snakeLoop();
}

let snakeNextDir = { x: 1, y: 0 };
let snakeLastTime = 0;

function snakeKey(e) {
  const dirs = {
    ArrowUp:    { x: 0, y: -1 },
    ArrowDown:  { x: 0, y: 1 },
    ArrowLeft:  { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    w: { x: 0, y: -1 }, W: { x: 0, y: -1 },
    s: { x: 0, y: 1 },  S: { x: 0, y: 1 },
    a: { x: -1, y: 0 }, A: { x: -1, y: 0 },
    d: { x: 1, y: 0 },  D: { x: 1, y: 0 },
  };
  const d = dirs[e.key];
  if (d) {
    if (d.x !== -snakeDir.x || d.y !== -snakeDir.y) snakeNextDir = d;
    e.preventDefault();
  }
}

function randomFood() {
  const cols = canvas.width / SZ;
  const rows = canvas.height / SZ;
  let f;
  do {
    f = { x: Math.floor(Math.random() * cols), y: Math.floor(Math.random() * rows) };
  } while (snake.some(s => s.x === f.x && s.y === f.y));
  return f;
}

function snakeLoop(ts = 0) {
  if (!gameRunning || gamePaused) return;
  animFrame = requestAnimationFrame(snakeLoop);
  if (ts - snakeLastTime < snakeSpeed) return;
  snakeLastTime = ts;
  
  snakeDir = snakeNextDir;
  const head = { x: snake[0].x + snakeDir.x, y: snake[0].y + snakeDir.y };
  const cols = canvas.width / SZ;
  const rows = canvas.height / SZ;
  
  // Wall collision
  if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows) { gameOver(); return; }
  // Self collision
  if (snake.some(s => s.x === head.x && s.y === head.y)) { gameOver(); return; }
  
  snake.unshift(head);
  
  if (head.x === snakeFood.x && head.y === snakeFood.y) {
    snakeFood = randomFood();
    updateScore(gameScore + 10);
    snakeSpeed = Math.max(60, snakeSpeed - 2);
  } else {
    snake.pop();
  }
  
  drawSnake();
}

function drawSnake() {
  ctx.fillStyle = '#0f0e17';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += SZ) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
  for (let y = 0; y < canvas.height; y += SZ) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
  
  // Food
  ctx.fillStyle = '#ff6b6b';
  ctx.shadowColor = '#ff6b6b';
  ctx.shadowBlur = 15;
  ctx.fillRect(snakeFood.x * SZ + 2, snakeFood.y * SZ + 2, SZ - 4, SZ - 4);
  ctx.shadowBlur = 0;
  
  // Snake
  snake.forEach((seg, i) => {
    const ratio = 1 - (i / snake.length) * 0.6;
    ctx.fillStyle = i === 0 ? '#06d6a0' : `rgba(6,214,160,${ratio})`;
    ctx.shadowColor = i === 0 ? '#06d6a0' : 'transparent';
    ctx.shadowBlur = i === 0 ? 10 : 0;
    ctx.fillRect(seg.x * SZ + 1, seg.y * SZ + 1, SZ - 2, SZ - 2);
  });
  ctx.shadowBlur = 0;
}

//   TETRIS  

const TCOLS = 10, TROWS = 20, TS = 24;
const TCOLORS = ['#ff6b6b','#ffd166','#06d6a0','#118ab2','#a56eff','#ff9f43','#00cec9'];
const TPIECES = [
  [[1,1,1,1]],
  [[1,1],[1,1]],
  [[0,1,0],[1,1,1]],
  [[1,0,0],[1,1,1]],
  [[0,0,1],[1,1,1]],
  [[0,1,1],[1,1,0]],
  [[1,1,0],[0,1,1]],
];

let tBoard, tPiece, tX, tY, tNext, tDropTimer, tLevel, tLines;

function initTetris() {
  canvas.width = TCOLS * TS + 120;
  canvas.height = TROWS * TS;
  tBoard = Array.from({length: TROWS}, () => Array(TCOLS).fill(0));
  tLevel = 1; tLines = 0;
  updateScore(0);
  tSpawnPiece();
  tDropTimer = 0;
  tetrisLoop();
}

function tSpawnPiece() {
  const idx = Math.floor(Math.random() * TPIECES.length);
  tPiece = TPIECES[idx].map(r => [...r]);
  tPieceColor = TCOLORS[idx];
  tX = Math.floor(TCOLS / 2) - Math.floor(tPiece[0].length / 2);
  tY = 0;
  if (!tValid(tPiece, tX, tY)) gameOver('YOU LOSE', gameScore);
}

function tValid(piece, px, py) {
  for (let r = 0; r < piece.length; r++)
    for (let c = 0; c < piece[r].length; c++)
      if (piece[r][c]) {
        const nx = px + c, ny = py + r;
        if (nx < 0 || nx >= TCOLS || ny >= TROWS) return false;
        if (ny >= 0 && tBoard[ny][nx]) return false;
      }
  return true;
}

function tLock() {
  for (let r = 0; r < tPiece.length; r++)
    for (let c = 0; c < tPiece[r].length; c++)
      if (tPiece[r][c] && tY + r >= 0)
        tBoard[tY + r][tX + c] = tPieceColor;
  
  // Clear lines
  let cleared = 0;
  for (let r = TROWS - 1; r >= 0; r--) {
    if (tBoard[r].every(c => c)) {
      tBoard.splice(r, 1);
      tBoard.unshift(Array(TCOLS).fill(0));
      cleared++; r++;
    }
  }
  if (cleared) {
    tLines += cleared;
    const pts = [0, 100, 300, 500, 800];
    updateScore(gameScore + (pts[cleared] || 800) * tLevel);
    tLevel = Math.floor(tLines / 10) + 1;
  }
  tSpawnPiece();
}

function tRotate(piece) {
  const rows = piece.length, cols = piece[0].length;
  const rot = Array.from({length: cols}, () => Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      rot[c][rows - 1 - r] = piece[r][c];
  return rot;
}

function tetrisKey(e) {
  if (!gameRunning) return;
  if (e.key === 'ArrowLeft')  { if (tValid(tPiece, tX-1, tY)) tX--; e.preventDefault(); }
  if (e.key === 'ArrowRight') { if (tValid(tPiece, tX+1, tY)) tX++; e.preventDefault(); }
  if (e.key === 'ArrowDown')  { if (tValid(tPiece, tX, tY+1)) tY++; else tLock(); e.preventDefault(); }
  if (e.key === 'ArrowUp') {
    const rot = tRotate(tPiece);
    if (tValid(rot, tX, tY)) tPiece = rot;
    e.preventDefault();
  }
  if (e.key === ' ') {
    while (tValid(tPiece, tX, tY+1)) tY++;
    tLock();
    e.preventDefault();
  }
  drawTetris();
}

let tLastTime = 0;
function tetrisLoop(ts = 0) {
  if (!gameRunning || gamePaused) return;
  animFrame = requestAnimationFrame(tetrisLoop);
  const dt = ts - tLastTime;
  tLastTime = ts;
  tDropTimer += dt;
  const dropInterval = Math.max(100, 800 - tLevel * 70);
  if (tDropTimer > dropInterval) {
    tDropTimer = 0;
    if (tValid(tPiece, tX, tY+1)) tY++;
    else tLock();
  }
  drawTetris();
}

let tPieceColor = '#fff';

function drawTetris() {
  const W = TCOLS * TS, H = TROWS * TS;
  ctx.fillStyle = '#0f0e17';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Board bg
  ctx.fillStyle = '#0a0912';
  ctx.fillRect(0, 0, W, H);
  
  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let c = 0; c <= TCOLS; c++) { ctx.beginPath(); ctx.moveTo(c*TS,0); ctx.lineTo(c*TS,H); ctx.stroke(); }
  for (let r = 0; r <= TROWS; r++) { ctx.beginPath(); ctx.moveTo(0,r*TS); ctx.lineTo(W,r*TS); ctx.stroke(); }
  
  // Board pieces
  for (let r = 0; r < TROWS; r++)
    for (let c = 0; c < TCOLS; c++)
      if (tBoard[r][c]) {
        ctx.fillStyle = tBoard[r][c];
        ctx.fillRect(c*TS+1, r*TS+1, TS-2, TS-2);
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(c*TS+1, r*TS+1, TS-2, 4);
      }
  
  // Ghost piece
  let gy = tY;
  while (tValid(tPiece, tX, gy+1)) gy++;
  for (let r = 0; r < tPiece.length; r++)
    for (let c = 0; c < tPiece[r].length; c++)
      if (tPiece[r][c] && gy+r >= 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect((tX+c)*TS+1, (gy+r)*TS+1, TS-2, TS-2);
      }
  
  // Current piece
  for (let r = 0; r < tPiece.length; r++)
    for (let c = 0; c < tPiece[r].length; c++)
      if (tPiece[r][c] && tY+r >= 0) {
        ctx.fillStyle = tPieceColor;
        ctx.shadowColor = tPieceColor;
        ctx.shadowBlur = 8;
        ctx.fillRect((tX+c)*TS+1, (tY+r)*TS+1, TS-2, TS-2);
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect((tX+c)*TS+1, (tY+r)*TS+1, TS-2, 4);
      }
  
  // Side panel
  const px = W + 10;
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '10px "Press Start 2P"';
  ctx.fillText('LEVEL', px, 30);
  ctx.fillStyle = '#ffd166';
  ctx.font = '14px "Press Start 2P"';
  ctx.fillText(tLevel, px, 50);
  
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '10px "Press Start 2P"';
  ctx.fillText('LINES', px, 80);
  ctx.fillStyle = '#06d6a0';
  ctx.font = '14px "Press Start 2P"';
  ctx.fillText(tLines, px, 100);
}

//   PONG  

let pPaddle, aBall, pScore, aScore, pKeys;

function initPong() {
  pPaddle = { y: canvas.height/2 - 40, h: 80, speed: 5 };
  const aiPaddle = { y: canvas.height/2 - 40, h: 80 };
  const ball = { x: canvas.width/2, y: canvas.height/2, vx: 4*(Math.random()>0.5?1:-1), vy: 3*(Math.random()>0.5?1:-1), r: 8 };
  pScore = 0; aScore = 0;
  pKeys = {};
  updateScore(0);
  
  window._pongState = { pPaddle, aiPaddle, ball, pScore, aScore };
  pongLoop();
}

function pongKey(e) {
  if (['ArrowUp','ArrowDown','w','W','s','S'].includes(e.key)) {
    pKeys[e.key] = e.type === 'keydown';
    e.preventDefault();
  }
}
document.addEventListener('keyup', e => { pKeys[e.key] = false; });

let pLastTime2 = 0;
function pongLoop(ts = 0) {
  if (!gameRunning || gamePaused) return;
  animFrame = requestAnimationFrame(pongLoop);
  
  const st = window._pongState;
  if (!st) return;
  const { aiPaddle, ball } = st;
  
  // Player movement
  const speed = 6;
  if (pKeys['ArrowUp'] || pKeys['w'] || pKeys['W']) st.pPaddle.y = Math.max(0, st.pPaddle.y - speed);
  if (pKeys['ArrowDown'] || pKeys['s'] || pKeys['S']) st.pPaddle.y = Math.min(canvas.height - st.pPaddle.h, st.pPaddle.y + speed);
  
  // AI movement
  const aiCenter = aiPaddle.y + aiPaddle.h/2;
  const aiTarget = ball.y;
  const aiSpeed = 3.5;
  if (aiCenter < aiTarget - 5) aiPaddle.y = Math.min(canvas.height - aiPaddle.h, aiPaddle.y + aiSpeed);
  if (aiCenter > aiTarget + 5) aiPaddle.y = Math.max(0, aiPaddle.y - aiSpeed);
  
  // Ball movement
  ball.x += ball.vx;
  ball.y += ball.vy;
  
  // Top/bottom bounce
  if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy *= -1; }
  if (ball.y + ball.r > canvas.height) { ball.y = canvas.height - ball.r; ball.vy *= -1; }
  
  // Player paddle
  if (ball.x - ball.r < 24 && ball.y > st.pPaddle.y && ball.y < st.pPaddle.y + st.pPaddle.h) {
    ball.vx = Math.abs(ball.vx) * 1.05;
    ball.vy += ((ball.y - (st.pPaddle.y + st.pPaddle.h/2)) / st.pPaddle.h * 2) * 2;
    ball.vx = Math.min(ball.vx, 12);
    st.pScore++;
    updateScore(st.pScore);
  }
  
  // AI paddle
  if (ball.x + ball.r > canvas.width - 24 && ball.y > aiPaddle.y && ball.y < aiPaddle.y + aiPaddle.h) {
    ball.vx = -Math.abs(ball.vx) * 1.02;
    ball.vy += ((ball.y - (aiPaddle.y + aiPaddle.h/2)) / aiPaddle.h * 2) * 2;
  }
  
  // Score
  if (ball.x < 0) {
    st.aScore++;
    if (st.aScore >= 7) { gameOver('PERDISTE', st.pScore); return; }
    ball.x = canvas.width/2; ball.y = canvas.height/2;
    ball.vx = -4; ball.vy = 3*(Math.random()>0.5?1:-1);
  }
  if (ball.x > canvas.width) {
    if (st.pScore >= 7) { gameOver('GANASTE! 🎉', st.pScore * 10); return; }
    ball.x = canvas.width/2; ball.y = canvas.height/2;
    ball.vx = 4; ball.vy = 3*(Math.random()>0.5?1:-1);
  }
  
  drawPong(st);
}

function drawPong(st) {
  ctx.fillStyle = '#0f0e17';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Center line
  ctx.setLineDash([8, 8]);
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(canvas.width/2, 0); ctx.lineTo(canvas.width/2, canvas.height); ctx.stroke();
  ctx.setLineDash([]);
  
  // Scores
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '32px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.fillText(st.pScore, canvas.width/2 - 60, 50);
  ctx.fillText(st.aScore, canvas.width/2 + 60, 50);
  ctx.textAlign = 'left';
  
  // Paddles
  ctx.fillStyle = '#118ab2';
  ctx.shadowColor = '#118ab2';
  ctx.shadowBlur = 15;
  ctx.fillRect(14, st.pPaddle.y, 10, st.pPaddle.h);
  
  ctx.fillStyle = '#ff6b6b';
  ctx.shadowColor = '#ff6b6b';
  ctx.fillRect(canvas.width - 24, st.aiPaddle.y, 10, st.aiPaddle.h);
  ctx.shadowBlur = 0;
  
  // Ball
  ctx.fillStyle = '#ffd166';
  ctx.shadowColor = '#ffd166';
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.arc(st.ball.x, st.ball.y, st.ball.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

//   BREAKOUT  

let bPaddle, bBall, bBricks, bLives;

function initBreakout() {
  bPaddle = { x: canvas.width/2 - 50, w: 100, y: canvas.height - 30, h: 12, speed: 0 };
  bBall = { x: canvas.width/2, y: canvas.height - 50, vx: 3, vy: -4, r: 7 };
  bLives = 3;
  bBricks = [];
  const rows = 5, cols = 10, bw = 42, bh = 16, gap = 4;
  const startX = (canvas.width - (cols * (bw + gap))) / 2;
  const colors = ['#ff6b6b','#ff9f43','#ffd166','#06d6a0','#118ab2'];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      bBricks.push({ x: startX + c*(bw+gap), y: 40 + r*(bh+gap), w: bw, h: bh, alive: true, color: colors[r] });
  
  updateScore(0);
  breakoutLoop();
  
  canvas.addEventListener('mousemove', bMouseMove);
}

function bMouseMove(e) {
  const rect = canvas.getBoundingClientRect();
  bPaddle.x = e.clientX - rect.left - bPaddle.w / 2;
  bPaddle.x = Math.max(0, Math.min(canvas.width - bPaddle.w, bPaddle.x));
}

let bKeys2 = {};
function breakoutKey(e) {
  if (['ArrowLeft','ArrowRight'].includes(e.key)) {
    bKeys2[e.key] = e.type === 'keydown';
    e.preventDefault();
  }
}
document.addEventListener('keyup', e => { bKeys2[e.key] = false; });

function breakoutLoop() {
  if (!gameRunning || gamePaused) return;
  animFrame = requestAnimationFrame(breakoutLoop);
  
  if (bKeys2['ArrowLeft']) bPaddle.x = Math.max(0, bPaddle.x - 7);
  if (bKeys2['ArrowRight']) bPaddle.x = Math.min(canvas.width - bPaddle.w, bPaddle.x + 7);
  
  bBall.x += bBall.vx;
  bBall.y += bBall.vy;
  
  // Walls
  if (bBall.x - bBall.r < 0) { bBall.x = bBall.r; bBall.vx *= -1; }
  if (bBall.x + bBall.r > canvas.width) { bBall.x = canvas.width - bBall.r; bBall.vx *= -1; }
  if (bBall.y - bBall.r < 0) { bBall.y = bBall.r; bBall.vy *= -1; }
  
  // Paddle
  if (bBall.y + bBall.r >= bPaddle.y && bBall.y + bBall.r <= bPaddle.y + bPaddle.h &&
      bBall.x >= bPaddle.x && bBall.x <= bPaddle.x + bPaddle.w) {
    bBall.vy = -Math.abs(bBall.vy);
    bBall.vx += ((bBall.x - (bPaddle.x + bPaddle.w/2)) / (bPaddle.w/2)) * 2;
  }
  
  // Bottom
  if (bBall.y > canvas.height + 20) {
    bLives--;
    if (bLives <= 0) { gameOver('GAME OVER', gameScore); return; }
    bBall.x = canvas.width/2; bBall.y = canvas.height - 50;
    bBall.vx = 3; bBall.vy = -4;
  }
  
  // Bricks
  bBricks.forEach(br => {
    if (!br.alive) return;
    if (bBall.x + bBall.r > br.x && bBall.x - bBall.r < br.x + br.w &&
        bBall.y + bBall.r > br.y && bBall.y - bBall.r < br.y + br.h) {
      br.alive = false;
      bBall.vy *= -1;
      updateScore(gameScore + 50);
    }
  });
  
  if (bBricks.every(b => !b.alive)) { gameOver('¡GANASTE! 🎉', gameScore + 500); return; }
  
  drawBreakout();
}

function drawBreakout() {
  ctx.fillStyle = '#0f0e17';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Lives
  ctx.fillStyle = '#ff6b6b';
  ctx.font = '10px "Press Start 2P"';
  for (let i = 0; i < bLives; i++) {
    ctx.fillText('♥', 12 + i * 22, 20);
  }
  
  // Bricks
  bBricks.forEach(br => {
    if (!br.alive) return;
    ctx.fillStyle = br.color;
    ctx.shadowColor = br.color;
    ctx.shadowBlur = 6;
    ctx.fillRect(br.x, br.y, br.w, br.h);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(br.x, br.y, br.w, 4);
    ctx.shadowBlur = 0;
  });
  
  // Paddle
  ctx.fillStyle = '#ff6b6b';
  ctx.shadowColor = '#ff6b6b';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.roundRect(bPaddle.x, bPaddle.y, bPaddle.w, bPaddle.h, 6);
  ctx.fill();
  ctx.shadowBlur = 0;
  
  // Ball
  ctx.fillStyle = '#ffd166';
  ctx.shadowColor = '#ffd166';
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(bBall.x, bBall.y, bBall.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

//   TOUCH CONTROLS  

// --- Swipe detection (Snake & Tetris) ---
let touchStartX = 0, touchStartY = 0;

document.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchend', e => {
  if (!gameRunning) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  const absDx = Math.abs(dx), absDy = Math.abs(dy);
  if (Math.max(absDx, absDy) < 20) return; // ignorar taps

  if (currentGame === 'snake') {
    if (absDx > absDy) {
      snakeKey({ key: dx > 0 ? 'ArrowRight' : 'ArrowLeft', preventDefault: () => {} });
    } else {
      snakeKey({ key: dy > 0 ? 'ArrowDown' : 'ArrowUp', preventDefault: () => {} });
    }
  }

  if (currentGame === 'tetris') {
    if (absDx > absDy) {
      tetrisKey({ key: dx > 0 ? 'ArrowRight' : 'ArrowLeft', preventDefault: () => {} });
    } else if (dy > 0) {
      tetrisKey({ key: 'ArrowDown', preventDefault: () => {} });
    } else {
      tetrisKey({ key: 'ArrowUp', preventDefault: () => {} }); // rotar
    }
  }
}, { passive: true });

// --- Crear D-pad / botones virtuales ---
function createTouchPad() {
  removeTouchPad();
  const game = currentGame;
  if (!['snake', 'tetris', 'pong', 'breakout'].includes(game)) return;

  const pad = document.createElement('div');
  pad.id = 'touch-pad';
  pad.style.cssText = `
    position: fixed;
    bottom: 70px;
    left: 0; right: 0;
    display: flex;
    justify-content: center;
    gap: 12px;
    z-index: 100;
    pointer-events: none;
    padding: 0 16px;
  `;

  // Snake & Tetris: D-pad con 4 flechas
  if (game === 'snake' || game === 'tetris') {
    pad.innerHTML = `
      <div style="display:grid;grid-template-columns:56px 56px 56px;grid-template-rows:56px 56px 56px;gap:6px;pointer-events:all">
        <div></div>
        <button class="tBtn" id="tbUp">▲</button>
        <div></div>
        <button class="tBtn" id="tbLeft">◀</button>
        <div></div>
        <button class="tBtn" id="tbRight">▶</button>
        <div></div>
        <button class="tBtn" id="tbDown">▼</button>
        <div></div>
      </div>
    `;
    document.body.appendChild(pad);
    const keyFn = game === 'snake' ? snakeKey : tetrisKey;
    const map = {
      tbUp:    'ArrowUp',
      tbDown:  'ArrowDown',
      tbLeft:  'ArrowLeft',
      tbRight: 'ArrowRight'
    };
    Object.entries(map).forEach(([id, key]) => {
      document.getElementById(id).addEventListener('touchstart', e => {
        e.preventDefault();
        keyFn({ key, preventDefault: () => {} });
      }, { passive: false });
    });
  }

  // Pong: botones arriba/abajo
  if (game === 'pong') {
    pad.innerHTML = `
      <div style="display:flex;gap:16px;pointer-events:all">
        <button class="tBtn tBtnLg" id="tbUp2">▲ ARRIBA</button>
        <button class="tBtn tBtnLg" id="tbDown2">▼ ABAJO</button>
      </div>
    `;
    document.body.appendChild(pad);
    document.getElementById('tbUp2').addEventListener('touchstart',  e => { e.preventDefault(); pKeys['ArrowUp'] = true; },    { passive: false });
    document.getElementById('tbUp2').addEventListener('touchend',    e => { e.preventDefault(); pKeys['ArrowUp'] = false; },   { passive: false });
    document.getElementById('tbDown2').addEventListener('touchstart',e => { e.preventDefault(); pKeys['ArrowDown'] = true; },  { passive: false });
    document.getElementById('tbDown2').addEventListener('touchend',  e => { e.preventDefault(); pKeys['ArrowDown'] = false; }, { passive: false });
  }

  // Breakout: botones izquierda/derecha
  if (game === 'breakout') {
    pad.innerHTML = `
      <div style="display:flex;gap:16px;pointer-events:all">
        <button class="tBtn tBtnLg" id="tbLeft2">◀ IZQ</button>
        <button class="tBtn tBtnLg" id="tbRight2">DER ▶</button>
      </div>
    `;
    document.body.appendChild(pad);
    document.getElementById('tbLeft2').addEventListener('touchstart',  e => { e.preventDefault(); bKeys2['ArrowLeft'] = true; },   { passive: false });
    document.getElementById('tbLeft2').addEventListener('touchend',    e => { e.preventDefault(); bKeys2['ArrowLeft'] = false; },  { passive: false });
    document.getElementById('tbRight2').addEventListener('touchstart', e => { e.preventDefault(); bKeys2['ArrowRight'] = true; },  { passive: false });
    document.getElementById('tbRight2').addEventListener('touchend',   e => { e.preventDefault(); bKeys2['ArrowRight'] = false; }, { passive: false });
  }
}

function removeTouchPad() {
  const old = document.getElementById('touch-pad');
  if (old) old.remove();
}

//Memory
const EMOJIS = ['🎮','🕹️','👾','🎲','🎯','🎪','🎨','🃏'];

function initMemory() {
  const cont = document.getElementById('memory-container');
  const cards = [...EMOJIS, ...EMOJIS].sort(() => Math.random() - 0.5);
  let flipped = [], matched = 0, moves = 0, locked = false;
  updateScore(0);
  
  cont.innerHTML = `
    <div style="text-align:center; margin-bottom:16px; font-family:'Press Start 2P',monospace; font-size:10px; color:var(--muted)">
      MOVIMIENTOS: <span id="mem-moves" style="color:var(--accent2)">0</span> &nbsp; PARES: <span id="mem-pairs" style="color:var(--accent3)">0/8</span>
    </div>
    <div id="mem-grid" style="
      display:grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      padding: 0 16px 16px;
    "></div>
  `;
  
  const grid = document.getElementById('mem-grid');
  cards.forEach((emoji, i) => {
    const card = document.createElement('div');
    card.style.cssText = `
      height: 80px;
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      cursor: pointer;
      transition: all 0.3s;
      user-select: none;
    `;
    card.dataset.emoji = emoji;
    card.dataset.idx = i;
    card.textContent = '?';
    card.style.fontFamily = "'Press Start 2P', monospace";
    card.style.color = 'var(--border)';
    card.style.fontSize = '20px';
    
    card.onclick = () => {
      if (locked || card.dataset.revealed || flipped.length >= 2) return;
      card.textContent = emoji;
      card.style.fontSize = '28px';
      card.style.color = 'var(--text)';
      card.style.background = 'var(--surface)';
      card.style.borderColor = 'var(--accent)';
      card.style.boxShadow = '0 0 15px rgba(255,107,107,0.3)';
      card.dataset.revealed = '1';
      flipped.push(card);
      
      if (flipped.length === 2) {
        moves++;
        document.getElementById('mem-moves').textContent = moves;
        locked = true;
        if (flipped[0].dataset.emoji === flipped[1].dataset.emoji) {
          matched++;
          document.getElementById('mem-pairs').textContent = matched + '/8';
          flipped[0].style.borderColor = 'var(--accent3)';
          flipped[1].style.borderColor = 'var(--accent3)';
          flipped[0].style.boxShadow = '0 0 15px rgba(6,214,160,0.4)';
          flipped[1].style.boxShadow = '0 0 15px rgba(6,214,160,0.4)';
          flipped[0].style.opacity = '0.7';
          flipped[1].style.opacity = '0.7';
          flipped[0].onclick = null;
          flipped[1].onclick = null;
          flipped = []; locked = false;
          updateScore(gameScore + Math.max(50, 200 - moves * 5));
          if (matched === 8) {
            setTimeout(() => gameOver('¡GANASTE! 🎉', gameScore), 400);
          }
        } else {
          setTimeout(() => {
            flipped.forEach(c => {
              delete c.dataset.revealed;
              c.textContent = '?';
              c.style.fontSize = '20px';
              c.style.color = 'var(--border)';
              c.style.background = 'var(--surface2)';
              c.style.borderColor = 'var(--border)';
              c.style.boxShadow = 'none';
            });
            flipped = []; locked = false;
          }, 900);
        }
      }
    };
    grid.appendChild(card);
  });
}


canvas.width = 480;
canvas.height = 480;
