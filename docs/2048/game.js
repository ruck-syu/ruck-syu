(() => {
  const SIZE = 4;
  const STORAGE_BEST = "wish2048Best";
  const STORAGE_THEME = "wish2048Theme";
  const MAX_HISTORY = 20;

  const boardEl = document.getElementById("board");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const overlayEl = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlaySub = document.getElementById("overlay-sub");
  const keepGoingBtn = document.getElementById("keep-going");
  const retryBtn = document.getElementById("retry");
  const newBtn = document.getElementById("new-game");
  const undoBtn = document.getElementById("undo");
  const themeBtn = document.getElementById("theme-toggle");

  const state = {
    grid: emptyGrid(),
    score: 0,
    best: 0,
    history: [],
    won: false,
    keepGoing: false,
    over: false,
  };

  function emptyGrid() {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  }

  function cloneGrid(grid) {
    return grid.map((row) => row.slice());
  }

  function gridsEqual(a, b) {
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        if (a[r][c] !== b[r][c]) return false;
      }
    }
    return true;
  }

  function readBest() {
    try {
      const value = Number.parseInt(localStorage.getItem(STORAGE_BEST) || "0", 10);
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch {
      return 0;
    }
  }

  function saveBest() {
    try {
      localStorage.setItem(STORAGE_BEST, String(state.best));
    } catch {
      // Private mode or storage disabled: the game still works.
    }
  }

  function spawnTile() {
    const empty = [];
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        if (state.grid[r][c] === 0) empty.push([r, c]);
      }
    }
    if (empty.length === 0) return null;

    const [r, c] = empty[Math.floor(Math.random() * empty.length)];
    const value = Math.random() < 0.9 ? 2 : 4;
    state.grid[r][c] = value;
    return { r, c, value };
  }

  function coords(line, position, direction) {
    if (direction === "left") return [line, position];
    if (direction === "right") return [line, SIZE - 1 - position];
    if (direction === "up") return [position, line];
    return [SIZE - 1 - position, line];
  }

  function mergeLine(line) {
    const values = line.filter((value) => value !== 0);
    const merged = [];
    let gained = 0;

    for (let i = 0; i < values.length; i += 1) {
      if (values[i] === values[i + 1]) {
        const value = values[i] * 2;
        merged.push(value);
        gained += value;
        i += 1;
      } else {
        merged.push(values[i]);
      }
    }

    while (merged.length < SIZE) merged.push(0);
    return { line: merged, gained };
  }

  function slide(direction) {
    const next = emptyGrid();
    let gained = 0;

    for (let line = 0; line < SIZE; line += 1) {
      const values = [];
      for (let position = 0; position < SIZE; position += 1) {
        const [r, c] = coords(line, position, direction);
        values.push(state.grid[r][c]);
      }

      const result = mergeLine(values);
      gained += result.gained;

      for (let position = 0; position < SIZE; position += 1) {
        const [r, c] = coords(line, position, direction);
        next[r][c] = result.line[position];
      }
    }

    return { grid: next, gained };
  }

  function canMove() {
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        if (state.grid[r][c] === 0) return true;
        if (c < SIZE - 1 && state.grid[r][c] === state.grid[r][c + 1]) return true;
        if (r < SIZE - 1 && state.grid[r][c] === state.grid[r + 1][c]) return true;
      }
    }
    return false;
  }

  function render(spawned = null) {
    const fragment = document.createDocumentFragment();

    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        const cell = document.createElement("div");
        cell.className = "cell";

        const value = state.grid[r][c];
        if (value !== 0) {
          const tile = document.createElement("div");
          tile.className = value <= 2048 ? `tile v${value}` : "tile vbig";
          tile.textContent = String(value);
          tile.dataset.len = String(value).length;
          if (spawned && spawned.r === r && spawned.c === c) {
            tile.classList.add("new");
          }
          cell.appendChild(tile);
        }

        fragment.appendChild(cell);
      }
    }

    boardEl.replaceChildren(fragment);
  }

  function updateScores(bump = false) {
    scoreEl.textContent = String(state.score);
    bestEl.textContent = String(state.best);

    if (bump) {
      scoreEl.classList.remove("bump");
      void scoreEl.offsetWidth;
      scoreEl.classList.add("bump");
      window.setTimeout(() => scoreEl.classList.remove("bump"), 200);
    }
  }

  function updateUndo() {
    undoBtn.disabled = state.history.length === 0;
  }

  function showOverlay(title, subtitle, offerKeepGoing) {
    overlayTitle.textContent = title;
    overlaySub.textContent = subtitle;
    keepGoingBtn.hidden = !offerKeepGoing;
    overlayEl.hidden = false;
  }

  function hideOverlay() {
    overlayEl.hidden = true;
  }

  function newGame() {
    state.grid = emptyGrid();
    state.score = 0;
    state.history = [];
    state.won = false;
    state.keepGoing = false;
    state.over = false;

    spawnTile();
    const second = spawnTile();
    render(second);
    updateScores();
    updateUndo();
    hideOverlay();
  }

  function move(direction) {
    if (state.over || (state.won && !state.keepGoing)) return;

    const before = cloneGrid(state.grid);
    const result = slide(direction);
    if (gridsEqual(before, result.grid)) return;

    state.history.push({
      grid: before,
      score: state.score,
      won: state.won,
      keepGoing: state.keepGoing,
      over: state.over,
    });
    if (state.history.length > MAX_HISTORY) state.history.shift();

    state.grid = result.grid;
    state.score += result.gained;
    if (state.score > state.best) {
      state.best = state.score;
      saveBest();
    }

    const spawned = spawnTile();
    const justWon =
      !state.won && state.grid.some((row) => row.some((value) => value >= 2048));
    if (justWon) {
      state.won = true;
      state.keepGoing = false;
    }

    state.over = !canMove();

    render(spawned);
    updateScores(result.gained > 0);
    updateUndo();

    if (justWon) {
      showOverlay("You made 2048.", "Keep going, or start fresh.", true);
      return;
    }

    if (state.over) {
      showOverlay("No moves left.", "The tiles have spoken.", false);
    }
  }

  function undo() {
    const previous = state.history.pop();
    if (!previous) return;

    state.grid = previous.grid;
    state.score = previous.score;
    state.won = previous.won;
    state.keepGoing = previous.keepGoing;
    state.over = previous.over;

    render();
    updateScores();
    updateUndo();
    hideOverlay();
  }

  function applyTheme(theme) {
    const next = theme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    themeBtn.textContent = next === "light" ? "☾" : "☀";
    themeBtn.setAttribute(
      "aria-label",
      next === "light" ? "Switch to dark theme" : "Switch to light theme",
    );

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", next === "light" ? "#f7f8fc" : "#0b1020");
  }

  function initialTheme() {
    try {
      const stored = localStorage.getItem(STORAGE_THEME);
      if (stored === "light" || stored === "dark") return stored;
    } catch {
      // Fall through to the system preference.
    }
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }

  const keyDirections = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "up",
    ArrowDown: "down",
    a: "left",
    d: "right",
    w: "up",
    s: "down",
  };

  window.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const direction = keyDirections[event.key] || keyDirections[event.key.toLowerCase()];
    if (!direction) return;
    event.preventDefault();
    move(direction);
  });

  let pointerStart = null;

  boardEl.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
    try {
      boardEl.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is a nicety, not a requirement.
    }
  });

  boardEl.addEventListener("pointerup", (event) => {
    if (!pointerStart || pointerStart.id !== event.pointerId) return;

    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    pointerStart = null;

    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      move(dx > 0 ? "right" : "left");
    } else {
      move(dy > 0 ? "down" : "up");
    }
  });

  boardEl.addEventListener("pointercancel", () => {
    pointerStart = null;
  });

  newBtn.addEventListener("click", newGame);
  retryBtn.addEventListener("click", newGame);
  undoBtn.addEventListener("click", undo);

  keepGoingBtn.addEventListener("click", () => {
    state.keepGoing = true;
    state.over = !canMove();
    hideOverlay();
    if (state.over) {
      showOverlay("No moves left.", "The tiles have spoken.", false);
    }
  });

  themeBtn.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_THEME, next);
    } catch {
      // Theme still applies for this visit.
    }
  });

  state.best = readBest();
  applyTheme(initialTheme());
  newGame();
})();
