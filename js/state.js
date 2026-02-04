// js/state.js
export const BOARD_SIZE = 15;

export const appState = {
  playingPuzzle: false,

  // puzzle data loaded at runtime
  curPuzzle: {
    unsolvedPuzzle: [],
    solvedPuzzle: [],
    isLeaderboardAttempt: true, // Whether this puzzle counts for leaderboard
  },

  // HUD
  puzzleTotalMines: 0,

  // timer
  timerHandle: null,
  timerStartMs: null,

  // reset snapshot (player marks only)
  initialUnsolvedSnapshot: null,

  // saves
  saveStates: [], // [{id,name,createdAt,marks}]
  selectedSaveId: null,
  nextSaveId: 1,

  // regions
  regions: [], // {id, cells:Set<string>, minMines, maxMines, autoResolve}
  nextRegionId: 1,
  selectedRegionId: null,

  // region draft/select mode
  regionSelectMode: false,
  regionDraftCells: new Set(), // "r,c"

  // region auto-resolve countdown UI
  pendingRegionResolves: new Map(), // regionId -> {timeoutId, intervalId, deadlineMs}
};

// pastProgress - synced with localStorage
export const pastProgress = {
  completedPuzzles: {}, // {puzzleName: timeMs} (e.g., "Easy/Puzzle_1": 12345)
  inprogressPuzzles: {}, // {puzzleName: {name, progress, startTime, isLeaderboardAttempt, notes, regions, saves}}
};

const PAST_PROGRESS_KEY = "ms_pastProgress";

/**
 * Load pastProgress from localStorage
 */
export function loadPastProgressFromStorage() {
  try {
    const stored = localStorage.getItem(PAST_PROGRESS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      pastProgress.completedPuzzles = parsed.completedPuzzles || {};
      pastProgress.inprogressPuzzles = parsed.inprogressPuzzles || {};
    }
  } catch (err) {
    console.error("Failed to load pastProgress from localStorage:", err);
  }
}

/**
 * Save pastProgress to localStorage
 */
export function savePastProgressToStorage() {
  try {
    localStorage.setItem(PAST_PROGRESS_KEY, JSON.stringify(pastProgress));
  } catch (err) {
    console.error("Failed to save pastProgress to localStorage:", err);
  }
}

/**
 * Mark a puzzle as completed with time
 * @param {string} puzzleName - The puzzle identifier (e.g., "Easy/Puzzle_1")
 * @param {number} timeMs - Time taken in milliseconds
 */
export function markPuzzleCompleted(puzzleName, timeMs) {
  delete pastProgress.inprogressPuzzles[puzzleName];
  if (isPuzzleCompleted(puzzleName) && pastProgress.completedPuzzles[puzzleName] <= timeMs) {
    return; // Already completed with equal or better time
  }
  pastProgress.completedPuzzles[puzzleName] = timeMs;
  savePastProgressToStorage();
}

/**
 * Save in-progress puzzle state
 * @param {string} puzzleName - The puzzle identifier (e.g., "Easy/Puzzle_1")
 * @param {object} puzzleState - {progress, startTime, isLeaderboardAttempt, notes, regions, saves}
 */
export function saveInProgressPuzzle(puzzleName, puzzleState) {
  pastProgress.inprogressPuzzles[puzzleName] = {
    name: puzzleName,
    ...puzzleState
  };
  savePastProgressToStorage();
}

/**
 * Get a specific in-progress puzzle
 * @param {string} puzzleName
 * @returns {object|null}
 */
export function getInProgressPuzzle(puzzleName) {
  return pastProgress.inprogressPuzzles[puzzleName] || null;
}

/**
 * Check if a puzzle is completed
 * @param {string} puzzleName
 * @returns {boolean}
 */
export function isPuzzleCompleted(puzzleName) {
  return puzzleName in pastProgress.completedPuzzles;
}

/**
 * Get completion time for a puzzle
 * @param {string} puzzleName
 * @returns {number|null} Time in milliseconds, or null if not completed
 */
export function getPuzzleCompletionTime(puzzleName) {
  return pastProgress.completedPuzzles[puzzleName] ?? null;
}

/**
 * Remove a puzzle from in-progress (for restart)
 * @param {string} puzzleName
 */
export function removeInProgressPuzzle(puzzleName) {
  delete pastProgress.inprogressPuzzles[puzzleName];
  savePastProgressToStorage();
}

/**
 * Check if a puzzle is in progress
 * @param {string} puzzleName
 * @returns {boolean}
 */
export function isInProgress(puzzleName) {
  return puzzleName in pastProgress.inprogressPuzzles;
}

/**
 * Save entire puzzle state to in-progress
 * @param {string} puzzleName
 * @param {Array} progress - Current board marks (capturePlayerMarks)
 * @param {number} startTimeMs - Timer start time
 * @param {boolean} isLeaderboardAttempt
 * @param {string} notes
 * @param {Array} regions - Current regions state
 * @param {Array} saves - Current saves state
 */
export function savePuzzleProgress(puzzleName, progress, startTimeMs, isLeaderboardAttempt = false, notes = "", regions = null, saves = null) {
  const puzzleState = {
    name: puzzleName,
    progress,
    startTime: startTimeMs,
    isLeaderboardAttempt,
    notes,
    regions: structuredClone(regions),
    saves: structuredClone(saves),
  };
  saveInProgressPuzzle(puzzleName, puzzleState);
}

/**
 * Helper to convert milliseconds to time string HH:MM:SS
 */
export function formatTimeMs(ms) {
  const totalSec = Math.floor(ms / 1000);
  const hh = String(Math.floor(totalSec / 3600)).padStart(2, "0");
  const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export const constants = {
  AUTO_RESOLVE_DELAY_MS: 1000,
  PROPAGATION_DELAY_MS: 250,
};
