// js/disqualify.js
import { appState } from "./state.js";
import { dom } from "./dom.js";
import { isEditableCell, getCellMark } from "./board.js";

let pendingDisqualifyAction = null;
let pendingRevealAction = null;
let isCheckboxWarning = false;
let pendingSolutionCloseResolve = null;

export function showDisqualifyWarning(message = "This action will disqualify this puzzle from leaderboard submission.", isCheckbox = false) {
  isCheckboxWarning = isCheckbox;
  if (document.getElementById("disqualifyModalOverlay")) {
    document.getElementById("disqualifyMessage").textContent = message;
    document.getElementById("disqualifyModalOverlay").classList.add("show");
  }
}

export function hideDisqualifyWarning() {
  const overlay = document.getElementById("disqualifyModalOverlay");
  if (overlay) {
    overlay.classList.remove("show");
  }
  isCheckboxWarning = false;
  pendingDisqualifyAction = null;
}

export function confirmDisqualify() {
  // Mark the current puzzle as disqualified from leaderboard
  if (appState.curPuzzle.name) {
    appState.curPuzzle.isLeaderboardAttempt = false;
  }
  
  // Execute the pending action if one exists
  if (pendingDisqualifyAction && typeof pendingDisqualifyAction === "function") {
    pendingDisqualifyAction();
    pendingDisqualifyAction = null; // Clear after executing
  }
  
  hideDisqualifyWarning();
}

/**
 * Show disqualify warning and execute action only if user confirms
 * @param {Function} action - The function to execute if user confirms
 * @param {string} message - Custom warning message
 * @param {boolean} isCheckbox - Whether this is for a checkbox (affects modal behavior)
 */
export function requireDisqualifyConfirmation(action, message = "This action will disqualify this puzzle from leaderboard submission.", isCheckbox = false) {
  // Only warn if this is a leaderboard attempt
  if (!isCheckbox && !appState.curPuzzle.isLeaderboardAttempt) {
    action();
    return;
  }
  
  pendingDisqualifyAction = action;
  showDisqualifyWarning(message, isCheckbox);
}

/**
 * Check if all editable cells have been marked with 'x' or 'f'
 * @returns {boolean}
 */
function areAllEditableCellsMarked() {
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      if (isEditableCell(r, c)) {
        const mark = getCellMark(r, c);
        if (mark !== "x" && mark !== "f") {
          return false;
        }
      }
    }
  }
  return true;
}

/**
 * Show solution result modal
 * @param {boolean} isCorrect - Whether the solution is correct
 * @param {number} incorrectCount - Number of incorrect cells (only if incorrect)
 * @param {string} customMessage - Custom message to display (optional)
 * @param {boolean} isMineCountError - Whether this is a mine count error (don't show reveal button)
 */
export async function showSolutionResult(isCorrect, incorrectCount = 0, customMessage = null, isMineCountError = false) {
  const overlay = document.getElementById("solutionResultModalOverlay");
  const message = document.getElementById("solutionResultMessage");
  const actions = document.getElementById("solutionResultActions");
  
  if (isCorrect) {
    message.textContent = "Your puzzle solution is correct!";
    actions.style.display = "none";
  } else {
    // Use custom message if provided, otherwise default
    message.textContent = customMessage || "The puzzle is not solved yet.";
    // Only show reveal button if all editable cells are marked AND not a mine count error
    actions.style.display = (areAllEditableCellsMarked() && !isMineCountError) ? "block" : "none";
  }
  
  overlay.classList.add("show");
  return new Promise((resolve) => {
    pendingSolutionCloseResolve = resolve;
  });
}

export function hideSolutionResult() {
  const overlay = document.getElementById("solutionResultModalOverlay");
  if (overlay) {
    overlay.classList.remove("show");
  }
  pendingRevealAction = null;
  if (pendingSolutionCloseResolve) {
    const resolve = pendingSolutionCloseResolve;
    pendingSolutionCloseResolve = null;
    resolve();
  }
}

/**
 * Show resume/restart modal
 * @param {Function} resumeAction - Function to call if resuming
 * @param {Function} restartAction - Function to call if restarting
 * @param {object} inProgressPuzzle - The in-progress puzzle data
 */
export function showResumeRestartModal(resumeAction, restartAction, inProgressPuzzle) {
  const overlay = document.getElementById("resumeRestartModalOverlay");
  if (!overlay) return;
  
  const resumeBtn = document.getElementById("resumeBtn");
  const restartBtn = document.getElementById("restartBtn");
  const disqualifyMsg = document.getElementById("progressDisqualifyMsg");
  
  // Hide disqualify message if puzzle is already disqualified
  // Check the stored isLeaderboardAttempt value from inProgressPuzzle
  if (disqualifyMsg && inProgressPuzzle) {
    disqualifyMsg.style.display = (inProgressPuzzle.isLeaderboardAttempt ?? true) ? "block" : "none";
  }
  
  // Clear old listeners
  const newResumeBtn = resumeBtn.cloneNode(true);
  const newRestartBtn = restartBtn.cloneNode(true);
  resumeBtn.parentNode.replaceChild(newResumeBtn, resumeBtn);
  restartBtn.parentNode.replaceChild(newRestartBtn, restartBtn);
  
  // Add new listeners
  newResumeBtn.addEventListener("click", () => {
    overlay.classList.remove("show");
    if (resumeAction) resumeAction();
  });
  
  newRestartBtn.addEventListener("click", () => {
    overlay.classList.remove("show");
    if (restartAction) restartAction();
  });
  
  overlay.classList.add("show");
}

// Wire up modal buttons
document.addEventListener("DOMContentLoaded", () => {
  // Disqualify modal buttons
  const disqualifyCancelBtn = document.getElementById("disqualifyCancelBtn");
  const disqualifyConfirmBtn = document.getElementById("disqualifyConfirmBtn");
  
  if (disqualifyCancelBtn) {
    disqualifyCancelBtn.addEventListener("click", () => {
      // If this is a checkbox warning, uncheck and show region modal
      if (isCheckboxWarning) {
        const checkbox = document.getElementById("regionAutoResolveInput");
        if (checkbox) {
          checkbox.checked = false;
        }
        const regionModal = document.getElementById("regionModalOverlay");
        if (regionModal) {
          regionModal.classList.add("show");
        }
      }
      hideDisqualifyWarning();
    });
  }
  
  if (disqualifyConfirmBtn) {
    disqualifyConfirmBtn.addEventListener("click", () => {
      // If this is a checkbox warning, just show region modal and keep checkbox checked
      // The actual disqualification happens when clicking OK on the region modal
      if (isCheckboxWarning) {
        const regionModal = document.getElementById("regionModalOverlay");
        if (regionModal) {
          regionModal.classList.add("show");
        }
        hideDisqualifyWarning();
      } else {
        // For non-checkbox warnings, disqualify immediately
        confirmDisqualify();
      }
    });
  }
  
  // Solution result modal buttons
  const solutionResultCloseBtn = document.getElementById("solutionResultCloseBtn");
  const revealIncorrectBtn = document.getElementById("revealIncorrectBtn");
  
  if (solutionResultCloseBtn) {
    solutionResultCloseBtn.addEventListener("click", hideSolutionResult);
  }
  
  if (revealIncorrectBtn) {
    revealIncorrectBtn.addEventListener("click", () => {
      if (pendingRevealAction && typeof pendingRevealAction === "function") {
        // Save the action before hiding the modal (which clears it)
        const action = pendingRevealAction;
        hideSolutionResult();
        // Show disqualify warning before executing reveal
        requireDisqualifyConfirmation(
          action,
          "Revealing incorrect cells will disqualify this puzzle from leaderboard submission."
        );
      }
    });
  }
});

export function setPendingRevealAction(action) {
  pendingRevealAction = action;
}
