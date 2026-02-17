// js/board.js
import { BOARD_SIZE, appState, getInProgressPuzzle, isPuzzleCompleted} from "./state.js";
import { dom } from "./dom.js";
import { startTimer } from "./timer.js";
import { updateMineHud, computeTotalMinesFromSolved } from "./hud.js";
import { handleAutoResolveSchedulingForCell, resetAllRegions, renderRegionList } from "./regions.js";
import { resetAllSaves, renderSaveList } from "./saves.js";
import { showResumeRestartModal } from "./disqualify.js";
import { getTop10, renderLeaderBoard } from "./leaderBoard.js";

export function initBoard() {
  if (!dom.gameBoard) return;

  // build the 15x15 grid once
  dom.puzzleGameBox && (dom.puzzleGameBox.style.display = "none");

  dom.gameBoard.innerHTML = "";
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = document.createElement("div");
      cell.id = `(${r},${c})`;
      cell.className = "cell c0";
      cell.textContent = "0";
      dom.gameBoard.appendChild(cell);
    }
  }
}

export function parseCellId(cellId) {
  const m = cellId.match(/^\((\d+),(\d+)\)$/);
  if (!m) return null;
  return { r: Number(m[1]), c: Number(m[2]) };
}

export function isNumber(value) {
  return typeof value === "number" && !Number.isNaN(value);
}

export function isEditableCell(r, c) {
  const v = appState.curPuzzle.unsolvedPuzzle?.[r]?.[c];
  if (v === "F") return false;
  if (typeof v === "number") return false;
  return true;
}

export function getCellEl(r, c) {
  return document.getElementById(`(${r},${c})`);
}

export function getCellMark(r, c) {
  const el = getCellEl(r, c);
  if (!el) return "";
  const t = el.textContent;
  return t === "x" || t === "f" || t === "F" ? t : "";
}

/**
 * Set mark without cycling. mark: "", "x", "f"
 * - Respects non-editable cells (numbers, "F")
 * - Preserves color clue backgrounds (c2/c3)
 * - Notifies auto-resolve scheduler only if the text actually changed
 */
export function setCellMark(r, c, mark) {
  const el = getCellEl(r, c);
  if (!el) return;

  const before = el.textContent;

  const v = appState.curPuzzle.unsolvedPuzzle?.[r]?.[c];
  if (v === "F" || typeof v === "number") return;

  const isColor = el.classList.contains("c2") || el.classList.contains("c3");
  el.classList.remove("cx", "cf", "ce");

  if (mark === "x") {
    el.textContent = "x";
    if (!isColor) el.classList.add("cx");
  } else if (mark === "f") {
    el.textContent = "f";
    if (!isColor) el.classList.add("cf");
  } else {
    el.textContent = "";
    if (!isColor) el.classList.add("ce");
  }

  if (el.textContent !== before) {
    handleAutoResolveSchedulingForCell(r, c);
  }
}

/**
 * Cell click cycles: "" -> x -> f -> ""
 * Color clue cells keep their c2/c3 background.
 */
export function cellClickEvent(event) {
  /*if (hasRevealedCells()) {
    document.querySelectorAll('.incorrect-reveal').forEach(el => {
      el.classList.remove('incorrect-reveal');
    });
    hasRevealedCells(true, false);
  }*/

  const cell = event.currentTarget;
  let isColorClue = false;

  for (const cls of cell.classList) {
    if (cls.startsWith("c") && cls !== "cell") {
      isColorClue = cls === "c2" || cls === "c3";
      if (!isColorClue) cell.classList.remove(cls);
      break;
    }
  }

  switch (cell.textContent) {
    case "f":
      cell.textContent = "";
      if (!isColorClue) cell.classList.add("ce");
      break;
    case "x":
      cell.textContent = "f";
      if (!isColorClue) cell.classList.add("cf");
      break;
    default:
      cell.textContent = "x";
      if (!isColorClue) cell.classList.add("cx");
      break;
  }

  updateMineHud();

  const pos = parseCellId(cell.id);
  if (pos) handleAutoResolveSchedulingForCell(pos.r, pos.c);
}

function clearCellContentClasses(cell) {
  for (const cls of Array.from(cell.classList)) {
    if (cls.startsWith("c") && cls !== "cell") {
      cell.classList.remove(cls);
    }
  }
  cell.classList.remove("cx", "cf", "ce");
}

function attachEditable(cell) {
  cell.addEventListener("click", cellClickEvent);
}

function detachEditable(cell) {
  cell.removeEventListener("click", cellClickEvent);
}

const DIFFICULTIES = ["Easy", "Medium", "Hard", "Expert"];

// Your filesystem
function unsolvedTextUrl(difficulty, puzzleName) {
  return `Puzzles/Unsolved/AsText/${difficulty}/${puzzleName}.txt`;
}
function solvedTextUrl(difficulty, puzzleName) {
  return `Puzzles/Solutions/AsText/${difficulty}/${puzzleName}.txt`;
}

// Expect the .txt to contain JSON for a 2D array.
// Example file content: [[0,"x",...],...]
function parsePuzzleArray(text, urlForError) {
  const t = text.trim();
  try {
    return JSON.parse(t);
  } catch (e) {
    throw new Error(
      `Failed to JSON.parse puzzle text from ${urlForError}. ` +
        `Ensure the .txt contains valid JSON (e.g., [[0,"x"],["F",2]]).`
    );
  }
}

async function fetchTextIfExists(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null; // 404, etc.
  return await res.text();
}

async function findPuzzleInAnyDifficulty(difficulty, puzzleName) {
  const uUrl = unsolvedTextUrl(difficulty, puzzleName);
  const sUrl = solvedTextUrl(difficulty, puzzleName);
  const [uText, sText] = await Promise.all([
    fetchTextIfExists(uUrl),
    fetchTextIfExists(sUrl),
  ]);
  // Only accept if BOTH exist
  if (uText && sText) {
    return {
      difficulty,
      unsolved: parsePuzzleArray(uText, uUrl),
      solved: parsePuzzleArray(sText, sUrl),
    };
  }
}

/**
 * Paint board from filesystem puzzle text.
 * Now async because it probes via fetch().
 */
export async function loadPuzzle(pNumber) {
  const puzzleName = `Puzzle_${pNumber}`;
  var puzzleList = [];
  try {
    const response = await fetch('Puzzles/PuzzleList.txt');
    puzzleList = await response.json();
  } catch (err) {
    console.error("Failed to load puzzle list:", err);
  }

  let difficulty = "";
  for (let i=0; i<DIFFICULTIES.length; i++){ 
    difficulty = DIFFICULTIES[i] + "/" + puzzleName;
    let found = false;
    for (let j=0; j<puzzleList.length; j++) {
      if (puzzleList[j] == difficulty) {
        difficulty = DIFFICULTIES[i]
        found = true;
        break;
      }
    }
    if (found) {break;}
  }

  const found = await findPuzzleInAnyDifficulty(difficulty, puzzleName);
  if (!found) return;

  // Store difficulty so selection page / solved-state can use it
  appState.curPuzzle.difficulty = found.difficulty;
  appState.curPuzzle.name = puzzleName;
  appState.curPuzzle.isLeaderboardAttempt = isPuzzleCompleted(puzzleName) ? false : true;
  dom.leaderBoardName.textContent = `${difficulty} Puzzle ${pNumber}`;
  dom.leaderBoardNameMobile.textContent = `${difficulty} Puzzle ${pNumber}`;
  appState.curPuzzle.unsolvedPuzzle = structuredClone(found.unsolved);
  appState.curPuzzle.solvedPuzzle = structuredClone(found.solved);

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = getCellEl(r, c);
      if (!cell) continue;

      detachEditable(cell);
      clearCellContentClasses(cell);

      const token = appState.curPuzzle.unsolvedPuzzle[r][c];

      switch (token) {
        case "F":
          cell.classList.add("cF");
          cell.textContent = "F";
          break;

        case "f":
          cell.classList.add("cf");
          cell.textContent = "f";
          attachEditable(cell);
          break;

        case "x":
          cell.classList.add("cx");
          cell.textContent = "x";
          attachEditable(cell);
          break;

        case "c2":
        case "x2":
        case "f2": {
          cell.classList.add("c2");
          attachEditable(cell);
          const lead = String(token).slice(0, 1);
          cell.textContent = lead === "c" ? "" : lead;
          break;
        }

        case "c3":
        case "x3":
        case "f3": {
          cell.classList.add("c3");
          attachEditable(cell);
          const lead = String(token).slice(0, 1);
          cell.textContent = lead === "c" ? "" : lead;
          break;
        }
        
        case "c4":
          //This covers a bug in the python script where color clue 4 isn't converted to a 4
          appState.curPuzzle.unsolvedPuzzle[r][c] = 4;
          appState.curPuzzle.solvedPuzzle[r][c] = 4;
          cell.classList.add("c4");
          cell.textContent = 4;
          break;

        default:
          if (isNumber(token)) {
            cell.classList.add(`c${token}`);
            cell.textContent = String(token);
          } else {
            cell.classList.add("ce");
            cell.textContent = "";
            attachEditable(cell);
          }
          break;
      }
    }
  }
  appState.initialUnsolvedSnapshot = capturePlayerMarks();
  appState.puzzleTotalMines = computeTotalMinesFromSolved();
  updateMineHud();
  
  // Reset regions and saves first (clear old puzzle state)
  resetAllRegions();
  resetAllSaves();
  
  // Check if this puzzle has in-progress state
  const inProgressPuzzle = getInProgressPuzzle(appState.curPuzzle.name);
  if (inProgressPuzzle) {
    // Show resume/restart modal
    showResumeRestartModal(
      () => resumePuzzle(inProgressPuzzle),
      () => restartPuzzle(),
      inProgressPuzzle
    );
  } else {
    // Fresh puzzle start
    startTimer(0);
  }
  
  // Refresh the UI to display restored regions and saves
  renderRegionList();
  renderSaveList();
  
  getTop10(puzzleName).then((data) => {
    if (data.ok) {
      renderLeaderBoard(data.top);
    } else {
      console.error("Failed to fetch top scores:", data.error);
    }
  });
}

function resumePuzzle(inProgressPuzzle) {
  // Restore player marks
  applyPlayerMarks(inProgressPuzzle.progress);
  // Restore leaderboard attempt status
  appState.curPuzzle.isLeaderboardAttempt = inProgressPuzzle.isLeaderboardAttempt ?? true;
  // Restore notes
  if (dom.notesText) {
    dom.notesText.value = inProgressPuzzle.notes || "";
  }
  // Restore regions
  appState.regions = structuredClone(inProgressPuzzle.regions || []);
  // Convert cells arrays back to Sets (they're serialized as arrays in JSON)
  appState.regions.forEach((region) => {
    if (Array.isArray(region.cells)) {
      region.cells = new Set(region.cells);
    }
  });
  // Restore saves
  appState.saveStates = structuredClone(inProgressPuzzle.saves || []);
  // Update nextSaveId if needed
  if (appState.saveStates.length > 0) {
    appState.nextSaveId = Math.max(...appState.saveStates.map(s => s.id || 0)) + 1;
  }
  // Refresh UI
  renderRegionList();
  renderSaveList();
  // Resume timer with the original start time
  startTimer(inProgressPuzzle.elapsedMs ?? 0);
}

function restartPuzzle() {
  // Disqualify from leaderboard since player restarted
  appState.curPuzzle.isLeaderboardAttempt = false;
  // Clear notes
  if (dom.notesText) {
    dom.notesText.value = "";
  }
  // Start fresh timer
  startTimer(null);
}

/* Capture / restore player's marks (only for editable cells) */
export function capturePlayerMarks() {
  const marks = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (!isEditableCell(r, c)) {
        marks[r][c] = null;
        continue;
      }
      const cell = getCellEl(r, c);
      const t = cell?.textContent ?? "";
      marks[r][c] = t === "x" || t === "f" ? t : "";
    }
  }
  return marks;
}

export function applyPlayerMarks(marks) {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (!isEditableCell(r, c)) continue;
      const el = getCellEl(r, c);
      if (!el) continue;

      const isColor = el.classList.contains("c2") || el.classList.contains("c3");
      el.classList.remove("cx", "cf", "ce");

      const v = marks?.[r]?.[c] ?? "";
      if (v === "x") {
        el.textContent = "x";
        if (!isColor) el.classList.add("cx");
      } else if (v === "f") {
        el.textContent = "f";
        if (!isColor) el.classList.add("cf");
      } else {
        el.textContent = "";
        if (!isColor) el.classList.add("ce");
      }
    }
  }
  updateMineHud();
}
