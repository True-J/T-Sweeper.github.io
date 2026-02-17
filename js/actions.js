// js/actions.js
import { BOARD_SIZE, appState, markPuzzleCompleted, pastProgress } from "./state.js";
import { dom } from "./dom.js";
import { isEditableCell, getCellEl, applyPlayerMarks } from "./board.js";
import { stopTimer, startTimer, getElapsedMs } from "./timer.js";
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
      const elapsedMs = getElapsedMs();
      markPuzzleCompleted(appState.curPuzzle.name, elapsedMs);
      await loadThumbnails();
      await showSolutionResult(true);
      // Submit to leaderboard if not disqualified
      if (appState.curPuzzle.isLeaderboardAttempt) {
        var initials = prompt("Enter your 3-letter initials for the leaderboard:", "");
        if (initials && initials.trim().length === 3) {
          const pastProgressCount = Object.keys(pastProgress.completedPuzzles).length;
          try {
            await submitScore({
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
          const mark = cell?.textContent.toLowerCase()[0] ?? "";
          if (mark === "f") { count++; }
        }
      }
    }
    return count;
  }
  
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = getCellEl(r, c);
      if (!cell) continue;
      const cls = [...cell.classList].find(c => c.length === 2 && c.startsWith('c'));
      const token = Number.isNaN(Number(cls[1])) ? cls[1] : Number(cls[1]);
      const visibleMines = countVisibleMines(r, c);
      let shouldHighlight = false;
      if (token == "F" && visibleMines != 1) {
        shouldHighlight = true;
      }
      else if (typeof token === "number" && visibleMines != token) {
        shouldHighlight = true;
      }
      else if (typeof token === "string" && token.length == 2 && visibleMines != parseInt(token[1])) {
        shouldHighlight = true;
      }
      else if (token == "f" && (visibleMines < 2 || visibleMines > 3)) {
        shouldHighlight = true;
      }
      else if (token == "x" && (visibleMines < 2 || visibleMines > 4)) {
        shouldHighlight = true;
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
      startTimer(0);
    };
    
    requireDisqualifyConfirmation(
      resetAction,
      "Resetting your progress will disqualify this puzzle from leaderboard submission."
    );
  });
}
