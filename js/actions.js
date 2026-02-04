// js/actions.js
import { BOARD_SIZE, appState, markPuzzleCompleted, pastProgress } from "./state.js";
import { dom } from "./dom.js";
import { isEditableCell, getCellEl, applyPlayerMarks, capturePlayerMarks } from "./board.js";
import { stopTimer, startTimer } from "./timer.js";
import { loadThumbnails } from "./view.js";
import { showSolutionResult, requireDisqualifyConfirmation, setPendingRevealAction } from "./disqualify.js";
import { computeTotalMinesFromSolved, computeCurrentFoundMines } from "./hud.js";
import { getTop10, submitScore } from "./leaderBoard.js";

var isRevealedCells = false;

export function hasRevealedCells(change = false, changeTo = false) {
  if (change) isRevealedCells = changeTo;
  return isRevealedCells;
}

export function wireCheckSolutionButton() {
  dom.checkSolutionBtn?.addEventListener("click", async () => {
    const solved = appState.curPuzzle.solvedPuzzle;
    if (!solved || solved.length === 0) {
      alert("No solved puzzle loaded.");
      return;
    }

    // Check mine count first
    const totalMines = computeTotalMinesFromSolved();
    const currentMines = computeCurrentFoundMines();
    
    if (currentMines !== totalMines) {
      let mineCountMessage = "The puzzle is not solved yet.";
      if (currentMines > totalMines) {
        mineCountMessage = `Too many mines placed. You have ${currentMines} but need ${totalMines}.`;
      } else {
        mineCountMessage = `Not enough mines placed. You have ${currentMines} but need ${totalMines}.`;
      }
      showSolutionResult(false, 0, mineCountMessage, true);
      return;
    }

    let wrong = 0;
    let totalEditable = 0;

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (!isEditableCell(r, c)) continue;
        totalEditable++;

        const cell = getCellEl(r, c);
        const player = cell?.textContent ?? "";
        const solvedToken = solved[r][c];
        const solvedMark = typeof solvedToken === "string" ? solvedToken[0] : "";
        const normalizedPlayer = player === "x" || player === "f" ? player : "";

        if (normalizedPlayer !== solvedMark) wrong++;
      }
    }
    
    if (wrong === 0) {
      stopTimer();
      const elapsedMs = appState.timerStartMs ? Date.now() - appState.timerStartMs : 0;
      markPuzzleCompleted(appState.curPuzzle.name, elapsedMs);
      await loadThumbnails();
      await showSolutionResult(true);
      // Submit to leaderboard if not disqualified
      if (appState.curPuzzle.isLeaderboardAttempt) {
        var initials = prompt("Enter your 3-letter initials for the leaderboard:", "");
        initials = (initials ? initials : "") + "---";
        initials = initials.slice(3);
        if (initials && initials.trim().length === 3) {
          initials = initials.trim().toUpperCase();
          const pastProgressCount = Object.keys(pastProgress.completedPuzzles).length;
          try {
            submitScore({
              puzzleId: appState.curPuzzle.name,
              initials: initials.trim().toUpperCase(),
              timeMs: elapsedMs,
              meta: null,
              pastProgress: pastProgressCount
            });
          } catch (err) {
            console.error("Failed to submit score:", err);
          }
        }
      }
    } else {
      // Set up the reveal action for later if user clicks "Reveal Incorrect Cells"
      const revealAction = () => {
        revealIncorrectCells();
      };
      setPendingRevealAction(revealAction);
      showSolutionResult(false, wrong);
    }
  });
}

function revealIncorrectCells() {
  hasRevealedCells(true, true);
  const solved = appState.curPuzzle.solvedPuzzle;  
  // Helper function to count mines visible from a cell
  function countVisibleMines(r, c) {
    let count = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && (dr !== 0 || dc !== 0)) {
          const cell = getCellEl(nr, nc);
          const mark = cell?.textContent ?? "";
          if (mark === "F" || mark === "f") {
            count++;
          }
        }
      }
    }
    return count;
  }
  
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = getCellEl(r, c);
      if (!cell) continue;
      
      const unsolvedToken = appState.curPuzzle.unsolvedPuzzle?.[r]?.[c];
      const solvedToken = solved?.[r]?.[c];
      let shouldHighlight = false;
      
      // Criteria 1: F cell (given mine constraint) that has 0 or >1 mines it can see
      if (unsolvedToken === "F") {
        const visibleMines = countVisibleMines(r, c);
        if (visibleMines === 0 || visibleMines > 1) {
          shouldHighlight = true;
        }
      }
      // Criteria 2: Normal clue cell that can see less than or greater than its clue value
      else if (typeof unsolvedToken === "number") {
        const visibleMines = countVisibleMines(r, c);
        if (visibleMines !== unsolvedToken) {
          shouldHighlight = true;
        }
      }
      // Criteria 3: Color clue that can see less than or greater than its clue value
      else if (typeof solvedToken === "string" && solvedToken.length > 1) {
        // Color clues have format like "c2", "f3", etc. (letter + number)
        const clueValue = parseInt(solvedToken[1]);
        const visibleMines = countVisibleMines(r, c);
        if (visibleMines !== clueValue) {
          shouldHighlight = true;
        }
      }
      // Criteria 4: f cells see less than 2 or greater than 3 mines
      else if (solvedToken === "f") {
        const visibleMines = countVisibleMines(r, c);
        if (visibleMines < 2 || visibleMines > 3) {
          shouldHighlight = true;
        }
      }
      // Criteria 5: x cells see less than 2 or greater than 4 mines
      else if (solvedToken === "x") {
        const visibleMines = countVisibleMines(r, c);
        if (visibleMines < 2 || visibleMines > 4) {
          shouldHighlight = true;
        }
      }
      if (shouldHighlight) {
        cell.classList.add("incorrect-reveal");
      }
    }
  }
}

export function wireResetProgressButton() {
  dom.resetProgressBtn?.addEventListener("click", () => {
    if (!appState.initialUnsolvedSnapshot) return;
    
    const resetAction = () => {
      applyPlayerMarks(appState.initialUnsolvedSnapshot);
      // Restart the timer
      appState.timerStartMs = Date.now();
      startTimer();
    };
    
    requireDisqualifyConfirmation(
      resetAction,
      "Resetting your progress will disqualify this puzzle from leaderboard submission."
    );
  });
}
