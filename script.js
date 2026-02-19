const folderInput = document.getElementById('folderInput');
const dropZone = document.getElementById('dropZone');
const difficultySelect = document.getElementById('difficulty');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const peekBtn = document.getElementById('peekBtn');
const statusEl = document.getElementById('status');
const summaryEl = document.getElementById('summary');
const pairListEl = document.getElementById('pairList');
const board = document.getElementById('gameBoard');
const progressBar = document.getElementById('progressBar');

const movesEl = document.getElementById('moves');
const matchesEl = document.getElementById('matches');
const streakEl = document.getElementById('streak');
const timerEl = document.getElementById('timer');
const bestEl = document.getElementById('best');
const accuracyEl = document.getElementById('accuracy');

const DIFFICULTY = {
  easy: { mismatchDelay: 1050, peekMs: 2500, compactAtCards: 18 },
  normal: { mismatchDelay: 800, peekMs: 2000, compactAtCards: 14 },
  hard: { mismatchDelay: 600, peekMs: 1500, compactAtCards: 12 },
  expert: { mismatchDelay: 450, peekMs: 1100, compactAtCards: 10 }
};

let preparedDeck = [];
let currentObjectUrls = [];
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

folderInput.addEventListener('change', () => prepareFromFileList(folderInput.files));
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', restartGame);
peekBtn.addEventListener('click', peekAllCards);

['dragenter', 'dragover'].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add('active');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  dropZone.addEventListener(eventName, () => dropZone.classList.remove('active'));
});

dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  prepareFromFileList(event.dataTransfer?.files);
});

function normalizeBaseName(fileName) {
  const nameNoExt = fileName.replace(/\.[^.]+$/, '').toLowerCase().trim();
  return nameNoExt.replace(/[\s_-]*\d+$/, '');
}

function getDifficultyConfig() {
  return DIFFICULTY[difficultySelect.value] ?? DIFFICULTY.normal;
}

function releaseOldObjectUrls() {
  for (const url of currentObjectUrls) URL.revokeObjectURL(url);
  currentObjectUrls = [];
}

function prepareFromFileList(fileList) {
  stopTimer();
  gameStarted = false;
  resetHud();
  board.innerHTML = '';
  releaseOldObjectUrls();

  const files = [...(fileList || [])].filter((file) => file.type.startsWith('image/'));

  if (files.length === 0) {
    statusEl.textContent = 'No images found in dropped/selected content.';
    summaryEl.textContent = '';
    pairListEl.innerHTML = '';
    preparedDeck = [];
    totalPairs = 0;
    startBtn.disabled = true;
    restartBtn.disabled = true;
    peekBtn.disabled = true;
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
  const stats = [];

  for (const [key, group] of grouped.entries()) {
    const sorted = [...group].sort((a, b) => a.name.localeCompare(b.name));
    const pairCount = Math.floor(sorted.length / 2);

    if (pairCount === 0) {
      ignored += 1;
      continue;
    }

    stats.push({ key, files: sorted.length, pairs: pairCount });

    for (let i = 0; i < pairCount * 2; i += 2) {
      deck.push(createCardData(sorted[i], key), createCardData(sorted[i + 1], key));
    }
  }

  renderPairPreview(stats);
  preparedDeck = shuffle(deck);
  totalPairs = preparedDeck.length / 2;

  if (totalPairs === 0) {
    statusEl.textContent = 'Need at least 2 images with matching base names (example: pep + pep1).';
    summaryEl.textContent = '';
    startBtn.disabled = true;
    restartBtn.disabled = true;
    peekBtn.disabled = true;
    return;
  }

  statusEl.textContent = `Ready: ${preparedDeck.length} cards (${totalPairs} pairs) on ${difficultySelect.value} mode.`;
  summaryEl.textContent = ignored > 0
    ? `Ignored ${ignored} single-image group(s).`
    : 'All detected groups can be used.';
  startBtn.disabled = false;
  restartBtn.disabled = false;
  peekBtn.disabled = false;
}

function renderPairPreview(stats) {
  pairListEl.innerHTML = '';
  if (stats.length === 0) return;

  const rows = stats.sort((a, b) => b.pairs - a.pairs || a.key.localeCompare(b.key)).slice(0, 10);
  for (const item of rows) {
    const li = document.createElement('li');
    li.textContent = `${item.key}: ${item.files} images → ${item.pairs} pair(s)`;
    pairListEl.appendChild(li);
  }

  if (stats.length > rows.length) {
    const extra = document.createElement('li');
    extra.textContent = `… and ${stats.length - rows.length} more group(s).`;
    pairListEl.appendChild(extra);
  }
}

function createCardData(file, pairKey) {
  const src = URL.createObjectURL(file);
  currentObjectUrls.push(src);
  return {
    id: `${pairKey}-${crypto.randomUUID()}`,
    pairKey,
    name: file.name,
    src
  };
}

function startGame() {
  if (preparedDeck.length === 0) return;

  board.innerHTML = '';
  resetTurn();
  moves = 0;
  matchedPairs = 0;
  streak = 0;
  secondsElapsed = 0;
  gameStarted = true;
  resetHud();

  const compactAtCards = getDifficultyConfig().compactAtCards;
  board.classList.toggle('compact', preparedDeck.length >= compactAtCards);

  const frag = document.createDocumentFragment();
  for (const [index, cardData] of preparedDeck.entries()) {
    const card = buildCardElement(cardData);
    card.style.animationDelay = `${Math.min(index * 35, 520)}ms`;
    frag.appendChild(card);
  }
  board.appendChild(frag);

  startTimer();
  statusEl.textContent = 'Game started. Match all the cards!';
}

function restartGame() {
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
  if (lockBoard || card === firstCard || card.classList.contains('matched') || card.classList.contains('revealed')) return;
  card.classList.add('revealed');

  if (!firstCard) {
    firstCard = card;
    return;
  }

  secondCard = card;
  moves += 1;
  movesEl.textContent = `Moves: ${moves}`;

  if (firstCard.dataset.pair === secondCard.dataset.pair) {
    firstCard.classList.add('matched');
    secondCard.classList.add('matched');
    firstCard.disabled = true;
    secondCard.disabled = true;
    matchedPairs += 1;
    streak += 1;
    matchesEl.textContent = `Matches: ${matchedPairs}`;
    streakEl.textContent = `Streak: ${streak}`;
    updateProgress();
    updateAccuracy();
    resetTurn();

    if (matchedPairs === totalPairs) handleWin();
    return;
  }

  streak = 0;
  streakEl.textContent = 'Streak: 0';
  updateAccuracy();
  lockBoard = true;

  const mismatchDelay = getDifficultyConfig().mismatchDelay;
  window.setTimeout(() => {
    firstCard.classList.remove('revealed');
    secondCard.classList.remove('revealed');
    resetTurn();
  }, mismatchDelay);
}

function peekAllCards() {
  if (!gameStarted || lockBoard) return;
  lockBoard = true;
  const toReveal = [...board.querySelectorAll('.card:not(.matched)')];
  toReveal.forEach((card) => card.classList.add('revealed'));

  window.setTimeout(() => {
    toReveal.forEach((card) => card.classList.remove('revealed'));
    lockBoard = false;
    resetTurn();
  }, getDifficultyConfig().peekMs);
}

function handleWin() {
  stopTimer();
  const timeLabel = formatTime(secondsElapsed);
  statusEl.textContent = `🎉 You won in ${moves} moves and ${timeLabel}!`;
  const best = saveBestScore(secondsElapsed);
  bestEl.textContent = `Best: ${best ? formatTime(best) : '--'}`;
}

function updateProgress() {
  const pct = totalPairs > 0 ? (matchedPairs / totalPairs) * 100 : 0;
  progressBar.style.width = `${pct}%`;
}

function updateAccuracy() {
  if (moves === 0) {
    accuracyEl.textContent = 'Accuracy: --';
    return;
  }
  const accuracy = Math.round((matchedPairs / moves) * 100);
  accuracyEl.textContent = `Accuracy: ${accuracy}%`;
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
  if (!timerId) return;
  window.clearInterval(timerId);
  timerId = null;
}

function resetHud() {
  movesEl.textContent = `Moves: ${moves}`;
  matchesEl.textContent = `Matches: ${matchedPairs}`;
  streakEl.textContent = `Streak: ${streak}`;
  timerEl.textContent = `Time: ${formatTime(secondsElapsed)}`;
  progressBar.style.width = '0%';
  updateAccuracy();
}

function formatTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const secs = (totalSeconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function initBestScore() {
  const raw = Number(window.localStorage.getItem(BEST_KEY));
  bestEl.textContent = Number.isFinite(raw) && raw > 0
    ? `Best: ${formatTime(raw)}`
    : 'Best: --';
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
