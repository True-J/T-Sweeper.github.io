// js/dom.js
export function byId(id) {
  const el = document.getElementById(id);
  if (!el) console.warn(`Missing element: #${id}`);
  return el;
}

export function qs(sel) {
  const el = document.querySelector(sel);
  if (!el) console.warn(`Missing element: ${sel}`);
  return el;
}

export function qsa(sel) {
  return Array.from(document.querySelectorAll(sel));
}

export const dom = {
  // Sidebar buttons
  rulesBtn: byId("rulesBtn"),
  dailyPuzzleBtn: byId("dailyPuzzleBtn"),
  menuBtn: byId("menuBtn"),
  leaderBoard: byId("leaderboard"),
  leaderBoardName: byId("leaderboardName"),

  // Rail buttons
  railButtons: qsa(".rail-btn"),

  // Main views / containers
  content: qs(".content"),
  panel: byId("panel"),
  panelBody: byId("panelBody"),
  rulesList: byId("myTitle"),
  gameBoard: byId("gameBoard"),
  puzzleGameBox: byId("puzzleBox"),

  // HUD
  mineHud: byId("mineHud"),
  timeHud: byId("timeHud"),

  // Controls
  deleteRegionBtn: byId("deleteRegionBtn"),
  createRegionBtn: byId("createRegionBtn"),
  deleteSaveBtn: byId("deleteSaveBtn"),
  createSaveBtn: byId("createSaveBtn"),
  checkSolutionBtn: byId("checkSolutionBtn"),
  resetProgressBtn: byId("resetProgressBtn"),
  notesBox: byId("notesBox"),
  notesText: byId("notesText"),
  saveList: byId("saveList"),
  regionList: byId("regionList"),
  regionResolveMsg: byId("regionResolveMsg"),

  // Region modal
  regionModalOverlay: byId("regionModalOverlay"),
  regionMinInput: byId("regionMinInput"),
  regionMaxInput: byId("regionMaxInput"),
  regionAutoResolveInput: byId("regionAutoResolveInput"),
  regionCancelBtn: byId("regionCancelBtn"),
  regionOkBtn: byId("regionOkBtn"),
};
