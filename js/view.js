// js/view.js
import { dom } from "./dom.js";
import { appState, isPuzzleCompleted, getPuzzleCompletionTime } from "./state.js";
import { getDailyPuzzleNumber, isMobile } from "./main.js";

const viewEls = {
  panel: dom.panel,
  rulesList: dom.rulesList,
  puzzleGameBox: dom.puzzleGameBox,
};

export async function setView(viewName) {
  Object.values(viewEls).forEach((el) => el && (el.style.display = "none"));

  // sidebar-only buttons visible while playing
  dom.leaderBoardM.style.display = "none";
  dom.leaderBoard.style.display = "none";

  if (viewName === "panel") {
    await refreshPanel();
    dom.panel && (dom.panel.style.display = "block");
    return;
  }

  if (viewName === "rulesList") {
    dom.rulesList && (dom.rulesList.style.display = "block");
    return;
  }

  if (viewName === "puzzleGameBox") {
    if (isMobile) {
      dom.puzzleGameBox.style.display = "flex";
    } else {
      dom.puzzleGameBox.style.display = "grid";
    }
    if (isMobile) {
      dom.leaderBoardM.style.display = "block";
    } else {
      dom.leaderBoard.style.display = "block";
    }
    appState.playingPuzzle = true;

    return;
  }
}

export var thumbnails = {
  "Easy": [],
  "Medium": [],
  "Hard": [],
  "Expert": []
};

export async function loadThumbnails() {
  const DIFFICULTIES = ["Easy", "Medium", "Hard", "Expert"];
  for (let i = 0; i < DIFFICULTIES.length; i++) {
    thumbnails[DIFFICULTIES[i]] = [];
  }
  const maxPuzzle = `Puzzle_${getDailyPuzzleNumber()}`;
  var puzzleList = [];
  try {
    const response = await fetch('Puzzles/PuzzleList.txt');
    puzzleList = await response.json();
  } catch (err) {
    console.error("Failed to load puzzle list:", err);
  }
  let maxNum = 0;
  for (let i = 0; i < DIFFICULTIES.length; i++) {
    let found = false;
    let searchTerm = `${DIFFICULTIES[i]}/${maxPuzzle}`;
    for (let j = 0; j < puzzleList.length; j++) {
      found = (puzzleList[j] == searchTerm)
      if (found) {
        maxNum = j;
        break;
      }
    }
    if (found) break;
  }
  for (let i = 0; i < maxNum; i++) {
    let puzzleName = puzzleList[i]
    let difName = puzzleName.split("/")[0];
    let puzzleCompletedName = puzzleName.split("/")[1];
    let myObj = {
      id: puzzleName,
      puzzleNumber: parseInt(puzzleList[i].split("_")[1], 10),
      picture: `Puzzles/Unsolved/${puzzleName}.jpg`
    };
    if (isPuzzleCompleted(puzzleCompletedName)) {
      myObj.picture = `Puzzles/Solutions/${puzzleName}.jpg`;
    }
    thumbnails[difName].push(myObj);
  }
}

let currentCategory = "Easy"; // default

export async function refreshPanel() {
  if (!currentCategory) return;
  let tempCategory = (currentCategory == "Easy") ? "Medium" : "Easy";
  loadThumbnails().then(() => {
    renderImageGrid(thumbnails[currentCategory]);
  });
  loadThumbnails().then(() => {
    renderImageGrid(thumbnails[tempCategory]);
  });
  loadThumbnails().then(() => {
    renderImageGrid(thumbnails[currentCategory]);
  });
  return;
}

export async function selectCategory(category) {
  currentCategory = category;
  dom.railButtons.forEach((b) => b.classList.toggle("active", b.dataset.category === category));
  await loadThumbnails();
  renderImageGrid(thumbnails[category]);
}

var shouldWeLoadPuzzle = false;
export function shouldLoadPuzzle(changeTo) {
  shouldWeLoadPuzzle = changeTo;
}

export function renderImageGrid(items) {
  if (!dom.panelBody) return;

  dom.panelBody.innerHTML = "";
  const grid = document.createElement("div");
  grid.className = "image-grid";

  items.forEach((item) => {
    if (document.getElementById(item.id)) document.getElementById(item.id).remove();
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "image-tile";
    tile.id = item.id;

    // Image
    const img = document.createElement("img");
    img.className = "thumb";
    img.src = item.picture;
    img.alt = item.id;

    // Label (shown under image)
    const label = document.createElement("div");
    label.className = "label";
    let pn = item.id.split("/")[1];
    // If puzzle is completed, show time; otherwise show puzzle name
    if (isPuzzleCompleted(pn)) {
      const timeMs = getPuzzleCompletionTime(pn);
      const totalSec = Math.floor(timeMs / 1000);
      const hh = String(Math.floor(totalSec / 3600)).padStart(2, "0");
      const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
      const ss = String(totalSec % 60).padStart(2, "0");
      pn = `${pn.split("_")[0]} ${pn.split("_")[1]}`;
      label.textContent = `${pn} ${hh}:${mm}:${ss}`;
    } else {
      pn = `${pn.split("_")[0]} ${pn.split("_")[1]}`;
      label.textContent = pn;
    }

    tile.append(img, label);

    tile.addEventListener("click", () => {
      if (shouldWeLoadPuzzle){
        loadPuzzle(item.puzzleNumber);
        setView("puzzleGameBox");
      } else {
        //TODO: load the leaderboard instead of the puzzle
        
      }
    });

    grid.appendChild(tile);
  });

  dom.panelBody.appendChild(grid);
}
