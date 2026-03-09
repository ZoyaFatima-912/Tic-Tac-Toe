const state = {
  player: '',
  board: Array(9).fill(''),
  gameActive: false,
  playerTurn: true,
  difficulty: 'easy',
  stats: { wins: 0, losses: 0, draws: 0 },
  liveChartInstance: null
};

const winCombos = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];

// DOM refs
const loginScreen   = document.getElementById('login-screen');
const gameScreen    = document.getElementById('game-screen');
const usernameInput = document.getElementById('username-input');
const loginBtn      = document.getElementById('login-btn');
const loginError    = document.getElementById('login-error');
const displayName   = document.getElementById('display-name');
const logoutBtn     = document.getElementById('logout-btn');
const statusBar     = document.getElementById('status-bar');
const cells         = document.querySelectorAll('.cell');
const restartBtn    = document.getElementById('restart-btn');
const resultOverlay = document.getElementById('result-overlay');
const resultIcon    = document.getElementById('result-icon');
const resultTitle   = document.getElementById('result-title');
const resultMsg     = document.getElementById('result-msg');
const resultNewGame = document.getElementById('result-new-game');

// Difficulty buttons
document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.difficulty = btn.dataset.level;
    if (state.gameActive) startGame();
  });
});

// Login
function login() {
  const name = usernameInput.value.trim();
  if (!name) {
    loginError.classList.remove('d-none');
    usernameInput.focus();
    return;
  }
  loginError.classList.add('d-none');
  state.player = name;

  const saved = localStorage.getItem('ttt_stats_' + name);
  state.stats = saved ? JSON.parse(saved) : { wins: 0, losses: 0, draws: 0 };

  displayName.textContent = name;
  updateScoreBar();
  updateLiveChart();

  loginScreen.classList.remove('active');
  gameScreen.classList.add('active');
  startGame();
}

loginBtn.addEventListener('click', login);
usernameInput.addEventListener('keydown', e => { if (e.key === 'Enter') login(); });

// Logout
logoutBtn.addEventListener('click', () => {
  saveStats();
  state.player = '';
  state.board = Array(9).fill('');
  state.gameActive = false;
  usernameInput.value = '';
  gameScreen.classList.remove('active');
  loginScreen.classList.add('active');
  hideResultOverlay();
  if (state.liveChartInstance) {
    state.liveChartInstance.destroy();
    state.liveChartInstance = null;
  }
});

// Start / reset
function startGame() {
  state.board = Array(9).fill('');
  state.gameActive = true;
  state.playerTurn = true;

  cells.forEach(cell => {
    cell.innerHTML = '';
    cell.className = 'cell';
  });

  setStatus('<i class="fa-solid fa-circle-dot me-2 pulse-icon"></i>Your turn');
  hideResultOverlay();
}

restartBtn.addEventListener('click', startGame);
resultNewGame.addEventListener('click', startGame);

// Cell click
cells.forEach(cell => {
  cell.addEventListener('click', () => {
    const idx = parseInt(cell.dataset.index);
    if (!state.gameActive || !state.playerTurn || state.board[idx]) return;

    makeMove(idx, 'X');
    if (!checkEnd('X')) {
      state.playerTurn = false;
      setStatus('<i class="fa-solid fa-robot me-2"></i>AI is thinking...');
      setTimeout(aiMove, 550);
    }
  });
});

function makeMove(idx, mark) {
  state.board[idx] = mark;
  const cell = cells[idx];
  cell.classList.add('taken', mark === 'X' ? 'x-mark' : 'o-mark', 'cell-pop');
  const icon = document.createElement('i');
  icon.className = mark === 'X' ? 'fa-solid fa-xmark' : 'fa-solid fa-circle';
  cell.appendChild(icon);
}

// AI move — behaviour changes per difficulty
function aiMove() {
  if (!state.gameActive) return;

  const empty = state.board.map((v, i) => v === '' ? i : null).filter(i => i !== null);
  let idx;

  if (state.difficulty === 'easy') {
    // Fully random
    idx = empty[Math.floor(Math.random() * empty.length)];

  } else if (state.difficulty === 'medium') {
    // 50% chance of best move, otherwise random
    if (Math.random() < 0.5) {
      idx = minimax(state.board, 'O', 0).index;
    } else {
      idx = empty[Math.floor(Math.random() * empty.length)];
    }

  } else {
    // Hard — full minimax, unbeatable
    idx = minimax(state.board, 'O', 0).index;
  }

  makeMove(idx, 'O');
  if (!checkEnd('O')) {
    state.playerTurn = true;
    setStatus('<i class="fa-solid fa-circle-dot me-2 pulse-icon"></i>Your turn');
  }
}

function minimax(board, mark, depth) {
  const opponent = mark === 'O' ? 'X' : 'O';
  const win = getWinner(board);
  if (win === 'O') return { score: 10 - depth };
  if (win === 'X') return { score: depth - 10 };
  if (!board.includes('')) return { score: 0 };

  const moves = [];
  board.forEach((cell, i) => {
    if (!cell) {
      const newBoard = [...board];
      newBoard[i] = mark;
      const result = minimax(newBoard, opponent, depth + 1);
      moves.push({ index: i, score: result.score });
    }
  });

  return mark === 'O'
    ? moves.reduce((best, m) => m.score > best.score ? m : best)
    : moves.reduce((best, m) => m.score < best.score ? m : best);
}

function getWinner(board) {
  for (const [a, b, c] of winCombos) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}

function checkEnd(mark) {
  for (const combo of winCombos) {
    const [a, b, c] = combo;
    if (state.board[a] === mark && state.board[b] === mark && state.board[c] === mark) {
      highlightWin(combo);
      state.gameActive = false;
      if (mark === 'X') {
        state.stats.wins++;
        saveStats(); updateScoreBar(); updateLiveChart();
        setTimeout(() => showResult('win'), 700);
      } else {
        state.stats.losses++;
        saveStats(); updateScoreBar(); updateLiveChart();
        setTimeout(() => showResult('lose'), 700);
      }
      return true;
    }
  }
  if (!state.board.includes('')) {
    state.gameActive = false;
    state.stats.draws++;
    saveStats(); updateScoreBar(); updateLiveChart();
    setTimeout(() => showResult('draw'), 500);
    return true;
  }
  return false;
}

function highlightWin(combo) {
  combo.forEach(i => cells[i].classList.add('winning-cell'));
}

function showResult(type) {
  resultOverlay.classList.remove('d-none');
  if (type === 'win') {
    resultIcon.className = 'result-icon win-icon';
    resultIcon.innerHTML = '<i class="fa-solid fa-trophy"></i>';
    resultTitle.textContent = 'You Won!';
    resultMsg.textContent = 'Great job, ' + state.player + '!';
  } else if (type === 'lose') {
    resultIcon.className = 'result-icon lose-icon';
    resultIcon.innerHTML = '<i class="fa-solid fa-face-sad-tear"></i>';
    resultTitle.textContent = 'You Lost!';
    resultMsg.textContent = 'Better luck next time!';
  } else {
    resultIcon.className = 'result-icon draw-icon';
    resultIcon.innerHTML = '<i class="fa-solid fa-handshake"></i>';
    resultTitle.textContent = "It's a Draw!";
    resultMsg.textContent = 'Neck and neck!';
  }
}

function hideResultOverlay() {
  resultOverlay.classList.add('d-none');
}

// Update side panel stat boxes
function updateScoreBar() {
  const sw = document.getElementById('side-wins');
  const sl = document.getElementById('side-losses');
  const sd = document.getElementById('side-draws');
  if (sw) sw.textContent = state.stats.wins;
  if (sl) sl.textContent = state.stats.losses;
  if (sd) sd.textContent = state.stats.draws;
}

function saveStats() {
  if (state.player) {
    localStorage.setItem('ttt_stats_' + state.player, JSON.stringify(state.stats));
  }
}

function setStatus(html) {
  statusBar.innerHTML = html;
}

// Live bar chart in stats panel
function updateLiveChart() {
  const { wins, losses, draws } = state.stats;
  const total  = wins + losses + draws;
  const canvas  = document.getElementById('live-chart');
  const noGames = document.getElementById('live-no-games');

  if (!canvas) return;

  // Win rate bar
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
  const fill = document.getElementById('win-rate-fill');
  const pct  = document.getElementById('win-rate-pct');
  if (fill) fill.style.width = winRate + '%';
  if (pct)  pct.textContent  = winRate + '%';

  if (total === 0) {
    if (noGames) noGames.style.display = 'block';
    canvas.style.display = 'none';
    return;
  }

  if (noGames) noGames.style.display = 'none';
  canvas.style.display = 'block';

  if (state.liveChartInstance) {
    state.liveChartInstance.data.datasets[0].data = [wins, losses, draws];
    state.liveChartInstance.update();
    return;
  }

  state.liveChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: ['Wins', 'Losses', 'Draws'],
      datasets: [{
        data: [wins, losses, draws],
        backgroundColor: ['#FA5C5C', '#FD8A6B', '#FEC288'],
        borderColor: ['#FA5C5C', '#FD8A6B', '#FEC288'],
        borderWidth: 0,
        borderRadius: 12,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { family: 'Quicksand', size: 12, weight: 'bold' }, color: '#A67C6B' },
          border: { display: false }
        },
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, font: { family: 'Quicksand', size: 12, weight: 'bold' }, color: '#A67C6B' },
          grid: { color: 'rgba(250,92,92,0.1)' },
          border: { display: false }
        }
      }
    }
  });
}