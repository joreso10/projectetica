const folderInput = document.getElementById('folderInput');
const dropZone = document.getElementById('dropZone');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const statusEl = document.getElementById('status');
const summaryEl = document.getElementById('summary');
const board = document.getElementById('gameBoard');
const movesEl = document.getElementById('moves');
const matchesEl = document.getElementById('matches');
const streakEl = document.getElementById('streak');
const timerEl = document.getElementById('timer');
const bestEl = document.getElementById('best');

let preparedDeck = [];
let firstCard = null;
let secondCard = null;
let lockBoard = false;
let moves = 0;
let matchedPairs = 0;
let totalPairs = 0;
let streak = 0;
let timerId = null;
let secondsElapsed = 0;
let gameStarted = false;

const BEST_KEY = 'memory-game-best-seconds';
initBestScore();

folderInput.addEventListener('change', () => {
  prepareFromFileList(folderInput.files);
});

['dragenter', 'dragover'].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add('active');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  dropZone.addEventListener(eventName, () => {
    dropZone.classList.remove('active');
  });
});

dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  prepareFromFileList(event.dataTransfer?.files);
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', restartGame);

function normalizeBaseName(fileName) {
  const nameNoExt = fileName.replace(/\.[^.]+$/, '').toLowerCase().trim();
  return nameNoExt.replace(/[\s_-]*\d+$/, '');
}

function prepareFromFileList(fileList) {
  stopTimer();
  gameStarted = false;
  resetHud();
  const files = [...(fileList || [])].filter((file) => file.type.startsWith('image/'));

  if (files.length === 0) {
    statusEl.textContent = 'No images found in dropped/selected content.';
    summaryEl.textContent = '';
    preparedDeck = [];
    totalPairs = 0;
    startBtn.disabled = true;
    restartBtn.disabled = true;
    return;
  }

  const grouped = new Map();
  for (const file of files) {
    const key = normalizeBaseName(file.name);
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(file);
  }

  const deck = [];
  let ignored = 0;

  for (const [key, group] of grouped.entries()) {
    if (group.length < 2) {
      ignored += 1;
      continue;
    }

    const sorted = [...group].sort((a, b) => a.name.localeCompare(b.name));
    for (let i = 0; i < sorted.length - 1; i += 2) {
      const one = sorted[i];
      const two = sorted[i + 1];
      deck.push(createCardData(one, key), createCardData(two, key));
    }
  }

  preparedDeck = shuffle(deck);
  totalPairs = preparedDeck.length / 2;
  board.innerHTML = '';

  if (totalPairs === 0) {
    statusEl.textContent = 'Need at least 2 images with matching base names (example: pep + pep1).';
    summaryEl.textContent = '';
    startBtn.disabled = true;
    restartBtn.disabled = true;
    return;
  }

  statusEl.textContent = `Ready: ${preparedDeck.length} cards (${totalPairs} pairs).`;
  summaryEl.textContent = ignored > 0
    ? `Ignored ${ignored} name group(s) with only one image.`
    : 'All detected image groups can be used.';
  startBtn.disabled = false;
  restartBtn.disabled = false;
}

function createCardData(file, pairKey) {
  return {
    id: `${pairKey}-${crypto.randomUUID()}`,
    pairKey,
    name: file.name,
    src: URL.createObjectURL(file)
  };
}

function startGame() {
  if (preparedDeck.length === 0) return;

  board.innerHTML = '';
  resetTurn();
  lockBoard = false;
  moves = 0;
  matchedPairs = 0;
  streak = 0;
  secondsElapsed = 0;
  gameStarted = true;
  resetHud();

  const frag = document.createDocumentFragment();
  for (const [index, cardData] of preparedDeck.entries()) {
    const card = buildCardElement(cardData);
    card.style.animationDelay = `${Math.min(index * 40, 520)}ms`;
    frag.appendChild(card);
  }
  board.appendChild(frag);

  startTimer();
  statusEl.textContent = 'Game started. Flip cards and find all matching names!';
}

function restartGame() {
  if (!gameStarted && preparedDeck.length > 0) {
    startGame();
    return;
  }

  if (preparedDeck.length === 0) return;
  preparedDeck = shuffle(preparedDeck);
  startGame();
}

function buildCardElement(cardData) {
  const btn = document.createElement('button');
  btn.className = 'card';
  btn.type = 'button';
  btn.dataset.id = cardData.id;
  btn.dataset.pair = cardData.pairKey;
  btn.setAttribute('aria-label', `Memory card ${cardData.name}`);

  btn.innerHTML = `
    <span class="card-inner">
      <span class="card-face card-back">🂠</span>
      <span class="card-face card-front">
        <img src="${cardData.src}" alt="${cardData.name}" loading="lazy" />
        <span class="card-name">${cardData.name}</span>
      </span>
    </span>
  `;

  btn.addEventListener('click', () => flipCard(btn));
  return btn;
}

function flipCard(card) {
  if (lockBoard || card === firstCard || card.classList.contains('matched')) return;

  card.classList.add('revealed');

  if (!firstCard) {
    firstCard = card;
    return;
  }

  secondCard = card;
  moves += 1;
  movesEl.textContent = `Moves: ${moves}`;

  const isMatch = firstCard.dataset.pair === secondCard.dataset.pair;

  if (isMatch) {
    firstCard.classList.add('matched');
    secondCard.classList.add('matched');
    firstCard.disabled = true;
    secondCard.disabled = true;
    matchedPairs += 1;
    streak += 1;
    matchesEl.textContent = `Matches: ${matchedPairs}`;
    streakEl.textContent = `Streak: ${streak}`;
    firstCard.classList.add('celebrate');
    secondCard.classList.add('celebrate');
    resetTurn();

    if (matchedPairs === totalPairs) {
      handleWin();
    }
    return;
  }

  streak = 0;
  streakEl.textContent = 'Streak: 0';
  lockBoard = true;

  window.setTimeout(() => {
    firstCard.classList.remove('revealed');
    secondCard.classList.remove('revealed');
    resetTurn();
  }, 700);
}

function handleWin() {
  stopTimer();
  const timeLabel = formatTime(secondsElapsed);
  statusEl.textContent = `🎉 You won in ${moves} moves and ${timeLabel}!`;
  const best = saveBestScore(secondsElapsed);
  bestEl.textContent = `Best: ${best ? formatTime(best) : '--'}`;
}

function resetTurn() {
  firstCard = null;
  secondCard = null;
  lockBoard = false;
}

function startTimer() {
  stopTimer();
  timerId = window.setInterval(() => {
    secondsElapsed += 1;
    timerEl.textContent = `Time: ${formatTime(secondsElapsed)}`;
  }, 1000);
}

function stopTimer() {
  if (timerId) {
    window.clearInterval(timerId);
    timerId = null;
  }
}

function resetHud() {
  movesEl.textContent = `Moves: ${moves}`;
  matchesEl.textContent = `Matches: ${matchedPairs}`;
  streakEl.textContent = `Streak: ${streak}`;
  timerEl.textContent = `Time: ${formatTime(secondsElapsed)}`;
}

function formatTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const secs = (totalSeconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function initBestScore() {
  const raw = Number(window.localStorage.getItem(BEST_KEY));
  if (Number.isFinite(raw) && raw > 0) {
    bestEl.textContent = `Best: ${formatTime(raw)}`;
  } else {
    bestEl.textContent = 'Best: --';
  }
}

function saveBestScore(seconds) {
  const raw = Number(window.localStorage.getItem(BEST_KEY));
  const oldBest = Number.isFinite(raw) && raw > 0 ? raw : null;

  if (oldBest === null || seconds < oldBest) {
    window.localStorage.setItem(BEST_KEY, String(seconds));
    return seconds;
  }

  return oldBest;
}

function shuffle(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
