// js/main.js
import { dom } from "./dom.js";
import { loadPastProgressFromStorage } from "./state.js";
import { initBoard, loadPuzzle } from "./board.js";
import { setView, selectCategory, loadThumbnails, shouldLoadPuzzle } from "./view.js";
import { wireSaveButtons, renderSaveList } from "./saves.js";
import { wireRegionButtons, renderRegionList, applyRegionActiveHighlight } from "./regions.js";
import { wireCheckSolutionButton, wireResetProgressButton } from "./actions.js";

// Detect if mobile or not
export const isMobile = /Mobi|Android/i.test(navigator.userAgent);

// Load pastProgress from localStorage on page load
loadPastProgressFromStorage();

// Initial UI state

if (dom.notesBox) dom.notesBox.style.display = "flex";

// Board
initBoard();

// Views
dom.puzzleGameBox.style.display = "none";

// Sidebar button wiring
dom.menuBtn?.addEventListener("click", async () => {
  shouldLoadPuzzle = true;
  await loadThumbnails();
  setView("panel");
  const active = dom.railButtons.find((b) => b.classList.contains("active"));
  if (!active && dom.railButtons[0]?.dataset?.category) selectCategory(dom.railButtons[0].dataset.category);
});
loadThumbnails();

dom.leaderBoardBtn?.addEventListener("click", async () => {
  shouldLoadPuzzle = false;
  await loadThumbnails();
  setView("panel");
  const active = dom.railButtons.find((b) => b.classList.contains("active"));
  if (!active && dom.railButtons[0]?.dataset?.category) selectCategory(dom.railButtons[0].dataset.category);

});

export function getDailyPuzzleNumber() {
  const todayUTC = new Date();
  const startUTC = new Date("2026-01-05T00:00:00Z");
  //Computes the number of days between the 2 dates
  const daysDiff = Math.floor(Math.abs(todayUTC - startUTC)/ (1000 * 60 * 60 * 24));
  return daysDiff;
}

dom.dailyPuzzleBtn?.addEventListener("click", async () => {
  const dailyNumber = getDailyPuzzleNumber();
  setView("puzzleGameBox");
  await loadPuzzle(dailyNumber);
});

dom.rulesBtn?.addEventListener("click", () => setView("rulesList"));

// Rail buttons
dom.railButtons.forEach((btn) => {
  btn.addEventListener("click", () => selectCategory(btn.dataset.category));
});

// Controls
wireSaveButtons();
wireRegionButtons();
wireCheckSolutionButton();
wireResetProgressButton();

// Initial lists
renderSaveList();
renderRegionList();
applyRegionActiveHighlight();

// Compatibility: expose key functions globally if any other scripts rely on them
window.loadPuzzle = loadPuzzle;
