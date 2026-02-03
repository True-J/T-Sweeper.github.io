// js/main.js
import { dom } from "./dom.js";
import { appState, loadPastProgressFromStorage } from "./state.js";
import { initBoard, loadPuzzle } from "./board.js";
import { setView, selectCategory, loadThumbnails } from "./view.js";
import { wireSaveButtons, renderSaveList } from "./saves.js";
import { wireRegionButtons, renderRegionList, applyRegionActiveHighlight } from "./regions.js";
import { wireCheckSolutionButton, wireResetProgressButton } from "./actions.js";

// Load pastProgress from localStorage on page load
loadPastProgressFromStorage();

// Initial UI state
if (dom.leaderBoardBtn) dom.leaderBoardBtn.style.display = "none";
if (dom.settingsBtn) dom.settingsBtn.style.display = "none";
if (dom.notesBox) dom.notesBox.style.display = "flex";

// Board
initBoard();

// Views
if (dom.puzzleGameBox) dom.puzzleGameBox.style.display = "none";

// Sidebar button wiring
dom.menuBtn?.addEventListener("click", async () => {
  await loadThumbnails();
  setView("panel");
  const active = dom.railButtons.find((b) => b.classList.contains("active"));
  if (!active && dom.railButtons[0]?.dataset?.category) selectCategory(dom.railButtons[0].dataset.category);
});
loadThumbnails();

export function getDailyPuzzleNumber() {
  const todayUTC = new Date();
  const startUTC = new Date("2026-01-05T00:00:00Z");
  //Computes the number of days between the 2 dates
  const daysDiff = Math.floor(Math.abs(todayUTC - startUTC)/ (1000 * 60 * 60 * 24));
  return daysDiff;
}

dom.dailyPuzzleBtn?.addEventListener("click", async () => {
  const dailyNumber = getDailyPuzzleNumber();
  await loadPuzzle(dailyNumber);
  setView("puzzleGameBox");
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
