// js/regions.js
import { BOARD_SIZE, appState, constants } from "./state.js";
import { dom } from "./dom.js";
import { getCellEl, getCellMark, isEditableCell, setCellMark } from "./board.js";
import { updateMineHud } from "./hud.js";

/* ---------- Draft UI helpers ---------- */
function cellKey(r, c) {
  return `${r},${c}`;
}

function parseKey(k) {
  const [r, c] = k.split(",").map(Number);
  return { r, c };
}

function clearDraftUI() {
  for (const k of appState.regionDraftCells) {
    const { r, c } = parseKey(k);
    const el = getCellEl(r, c);
    el?.classList.remove("region-draft");
  }
  appState.regionDraftCells.clear();
}

function setCreateRegionButtonLabel() {
  if (dom.createRegionBtn) dom.createRegionBtn.textContent = appState.regionSelectMode ? "Confirm Region" : "Create Region";
  if (dom.deleteRegionBtn) dom.deleteRegionBtn.textContent = appState.regionSelectMode ? "Exit Create Region" : "Delete Region";
}

export function clearSelectedRegionUI() {
  appState.selectedRegionId = null;
  document.querySelectorAll("#regionList .list-item.active").forEach((el) => el.classList.remove("active"));
  document.querySelectorAll(".cell.region-active").forEach((cell) => cell.classList.remove("region-active"));
}

export function resetAllRegions() {
  // cancel pending countdowns
  for (const rid of Array.from(appState.pendingRegionResolves.keys())) cancelRegionResolve(rid);

  // clear selection/drafts/regions
  appState.regions = [];
  appState.nextRegionId = 1;
  appState.selectedRegionId = null;
  appState.regionSelectMode = false;
  clearDraftUI();
  disableRegionPickListeners();
  setCreateRegionButtonLabel();
  renderRegionList();
  applyRegionActiveHighlight();
}

export function renderRegionList() {
  if (!dom.regionList) return;
  dom.regionList.innerHTML = "";

  if (appState.regions.length === 0) {
    const empty = document.createElement("div");
    empty.style.fontSize = "13px";
    empty.textContent = "No regions";
    dom.regionList.appendChild(empty);
    return;
  }

  for (const reg of appState.regions) {
    const item = document.createElement("div");
    item.className = "list-item";
    item.textContent = `Region ${reg.id} (min ${reg.minMines}, max ${reg.maxMines})${reg.autoResolve ? " [auto]" : ""}`;

    if (reg.id === appState.selectedRegionId) item.classList.add("active");

    item.addEventListener("click", () => {
      appState.selectedRegionId = appState.selectedRegionId === reg.id ? null : reg.id;
      renderRegionList();
      applyRegionActiveHighlight();
    });

    dom.regionList.appendChild(item);
  }
}

export function applyRegionActiveHighlight() {
  // clear
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      getCellEl(r, c)?.classList.remove("region-active");
    }
  }

  if (appState.selectedRegionId == null) return;
  const reg = appState.regions.find((r) => r.id === appState.selectedRegionId);
  if (!reg) return;

  for (const k of reg.cells) {
    const { r, c } = parseKey(k);
    getCellEl(r, c)?.classList.add("region-active");
  }
}

/* ---------- Modal ---------- */
export function openRegionModal(cellCount) {
  return new Promise((resolve) => {
    if (!dom.regionModalOverlay) return resolve(null);

    dom.regionMinInput.min = "0";
    dom.regionMinInput.max = String(cellCount);
    dom.regionMinInput.value = "0";

    dom.regionMaxInput.min = "0";
    dom.regionMaxInput.max = String(cellCount);
    dom.regionMaxInput.value = String(Math.min(1, cellCount));

    dom.regionAutoResolveInput.checked = false;

    dom.regionModalOverlay.classList.add("show");

    const cleanup = (result) => {
      dom.regionModalOverlay.classList.remove("show");
      dom.regionOkBtn.onclick = null;
      dom.regionCancelBtn.onclick = null;
      dom.regionAutoResolveInput.onchange = null;
      resolve(result);
    };

    dom.regionCancelBtn.onclick = () => cleanup(null);

    dom.regionOkBtn.onclick = () => {
      const minM = Number(dom.regionMinInput.value);
      const maxM = Number(dom.regionMaxInput.value);

      if (!Number.isInteger(minM) || !Number.isInteger(maxM)) return alert("Min and max must be whole numbers.");
      if (minM < 0 || maxM < 0) return alert("Min and max must be >= 0.");
      if (minM > maxM) return alert("Minimum mines cannot exceed maximum mines.");
      if (maxM > cellCount) return alert("Maximum mines cannot exceed the number of cells in the region.");

      const autoResolveEnabled = dom.regionAutoResolveInput.checked;
      
      cleanup({
        minMines: minM,
        maxMines: maxM,
        autoResolve: autoResolveEnabled,
      });
    };
  });
}

/* ---------- Region picking (capture-phase click) ---------- */
function regionPickHandler(e) {
  if (!appState.regionSelectMode) return;

  const el = e.currentTarget;
  const m = el.id.match(/^\((\d+),(\d+)\)$/);
  if (!m) return;

  const r = Number(m[1]);
  const c = Number(m[2]);
  if (!isEditableCell(r, c)) return;

  const k = cellKey(r, c);
  if (appState.regionDraftCells.has(k)) {
    appState.regionDraftCells.delete(k);
    el.classList.remove("region-draft");
  } else {
    appState.regionDraftCells.add(k);
    el.classList.add("region-draft");
  }

  e.stopPropagation();
}

function enableRegionPickListeners() {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      getCellEl(r, c)?.addEventListener("click", regionPickHandler, true);
    }
  }
}

function disableRegionPickListeners() {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      getCellEl(r, c)?.removeEventListener("click", regionPickHandler, true);
    }
  }
}

/* ---------- Auto-resolve logic ---------- */
function regionStats(reg) {
  let minesFound = 0;
  const unknownEditable = [];

  for (const k of reg.cells) {
    const { r, c } = parseKey(k);

    const mark = getCellMark(r, c);
    if (mark === "f" || mark === "F") {
      minesFound++;
      continue;
    }
    if (mark === "x") continue;

    if (isEditableCell(r, c)) unknownEditable.push({ r, c });
  }

  return { minesFound, unknownEditable };
}

function regionIsResolvableNow(reg) {
  if (!reg.autoResolve) return false;

  const { minesFound, unknownEditable } = regionStats(reg);
  if (unknownEditable.length === 0) return false;

  if (minesFound === reg.maxMines) return true;

  const remainingMin = reg.minMines - minesFound;
  if (remainingMin > 0 && unknownEditable.length === remainingMin) return true;

  return false;
}

/**
 * Applies forced moves for a region, returns true if anything changed.
 * Matches your original intent. :contentReference[oaicite:2]{index=2}
 */
function applyAutoResolveForRegion(reg) {
  if (!reg.autoResolve) return false;

  const { minesFound, unknownEditable } = regionStats(reg);
  if (unknownEditable.length === 0) return false;

  let changed = false;

  if (minesFound === reg.maxMines) {
    for (const { r, c } of unknownEditable) {
      const before = getCellMark(r, c);
      setCellMark(r, c, "x");
      const after = getCellMark(r, c);
      if (before !== after) changed = true;
    }
    return changed;
  }

  const remainingMin = reg.minMines - minesFound;
  if (remainingMin > 0 && unknownEditable.length === remainingMin) {
    for (const { r, c } of unknownEditable) {
      const before = getCellMark(r, c);
      setCellMark(r, c, "f");
      const after = getCellMark(r, c);
      if (before !== after) changed = true;
    }
    return changed;
  }

  return false;
}

/* ---------- Countdown UI + scheduling ---------- */
function hideResolveMsgIfNone() {
  if (!dom.regionResolveMsg) return;
  if (appState.pendingRegionResolves.size === 0) {
    dom.regionResolveMsg.style.display = "none";
    dom.regionResolveMsg.textContent = "";
  }
}

function updateResolveMsg() {
  if (!dom.regionResolveMsg) return;

  if (appState.pendingRegionResolves.size === 0) {
    hideResolveMsgIfNone();
    return;
  }

  let bestRegionId = null;
  let bestDeadline = Infinity;

  for (const [rid, info] of appState.pendingRegionResolves.entries()) {
    if (info.deadlineMs < bestDeadline) {
      bestDeadline = info.deadlineMs;
      bestRegionId = rid;
    }
  }

  const remainingMs = Math.max(0, bestDeadline - Date.now());
  const secs = (remainingMs / 1000).toFixed(2);

  dom.regionResolveMsg.style.display = "block";
  dom.regionResolveMsg.textContent = `Region ${bestRegionId} resolving in ${secs} seconds`;
}

function cancelRegionResolve(regionId) {
  const info = appState.pendingRegionResolves.get(regionId);
  if (!info) return;

  clearTimeout(info.timeoutId);
  clearInterval(info.intervalId);
  appState.pendingRegionResolves.delete(regionId);

  updateResolveMsg();
}

function scheduleEligibleAutoResolves(delayMs) {
  // Safe propagation: schedule any region that is *currently* forced-resolvable.
  for (const reg of appState.regions) {
    if (!reg.autoResolve) continue;
    if (!regionIsResolvableNow(reg)) continue;
    scheduleRegionResolve(reg.id, delayMs);
  }
}

function scheduleRegionResolve(regionId, delayMs = constants.AUTO_RESOLVE_DELAY_MS) {
  cancelRegionResolve(regionId);

  const deadlineMs = Date.now() + delayMs;
  const intervalId = setInterval(updateResolveMsg, 50);

  const timeoutId = setTimeout(() => {
    cancelRegionResolve(regionId);

    const reg = appState.regions.find((r) => r.id === regionId);
    if (!reg || !reg.autoResolve) return;

    const changed = applyAutoResolveForRegion(reg);
    updateMineHud();

    if (changed) scheduleEligibleAutoResolves(constants.PROPAGATION_DELAY_MS);
  }, delayMs);

  appState.pendingRegionResolves.set(regionId, { timeoutId, intervalId, deadlineMs });
  updateResolveMsg();
}

export function handleAutoResolveSchedulingForCell(r, c) {
  const k = cellKey(r, c);

  for (const reg of appState.regions) {
    if (!reg.autoResolve) continue;
    if (!reg.cells.has(k)) continue;

    if (regionIsResolvableNow(reg)) {
      scheduleRegionResolve(reg.id, constants.AUTO_RESOLVE_DELAY_MS);
    } else {
      cancelRegionResolve(reg.id);
    }
  }
}

/* ---------- Public wiring ---------- */
export function wireRegionButtons() {
  // Create Region (toggle -> confirm)
  dom.createRegionBtn?.addEventListener("click", async () => {
    if (!appState.regionSelectMode) {
      appState.regionSelectMode = true;
      clearSelectedRegionUI();
      clearDraftUI();
      setCreateRegionButtonLabel();
      enableRegionPickListeners();
      return;
    }

    if (appState.regionDraftCells.size <= 1) {
      alert("Select at least 2 cells to create a region.");
      return;
    }

    const config = await openRegionModal(appState.regionDraftCells.size);
    if (!config) return; // canceled; remain in selection mode

    const reg = {
      id: appState.nextRegionId++,
      cells: new Set(appState.regionDraftCells),
      minMines: config.minMines,
      maxMines: config.maxMines,
      autoResolve: config.autoResolve,
    };

    appState.regions.push(reg);
    appState.selectedRegionId = reg.id;

    appState.regionSelectMode = false;
    disableRegionPickListeners();
    clearDraftUI();
    setCreateRegionButtonLabel();

    renderRegionList();
    applyRegionActiveHighlight();

    // immediate pass in case it's already forced
    scheduleEligibleAutoResolves(0);
  });

  // Delete Region (or exit selection mode)
  dom.deleteRegionBtn?.addEventListener("click", () => {
    if (appState.regionSelectMode) {
      appState.regionSelectMode = false;
      disableRegionPickListeners();
      clearDraftUI();
      setCreateRegionButtonLabel();
      return;
    }

    if (appState.selectedRegionId == null) return;

    const idx = appState.regions.findIndex((r) => r.id === appState.selectedRegionId);
    if (idx === -1) return;

    appState.regions.splice(idx, 1);
    appState.selectedRegionId = appState.regions.length ? appState.regions[0].id : null;

    renderRegionList();
    applyRegionActiveHighlight();
  });
}

export function snapshotRegionsForSave() {
  return {
    nextRegionId: appState.nextRegionId,
    selectedRegionId: appState.selectedRegionId,
    regions: appState.regions.map((r) => ({
      id: r.id,
      cells: Array.from(r.cells), // Set -> Array
      minMines: r.minMines,
      maxMines: r.maxMines,
      autoResolve: r.autoResolve,
    })),
  };
}

export function restoreRegionsFromSave(snapshot) {
  // 1) Cancel pending auto-resolve timers cleanly
  for (const info of appState.pendingRegionResolves.values()) {
    clearTimeout(info.timeoutId);
    clearInterval(info.intervalId);
  }
  appState.pendingRegionResolves.clear();

  if (dom.regionResolveMsg) {
    dom.regionResolveMsg.style.display = "none";
    dom.regionResolveMsg.textContent = "";
  }

  // 2) Exit selection mode and clear draft UI state
  appState.regionSelectMode = false;
  appState.regionDraftCells.clear();

  // 3) Restore regions
  const snap = snapshot ?? { regions: [], nextRegionId: 1, selectedRegionId: null };

  appState.regions = (snap.regions ?? []).map((r) => ({
    id: r.id,
    cells: new Set(r.cells),
    minMines: r.minMines,
    maxMines: r.maxMines,
    autoResolve: r.autoResolve,
  }));

  // 4) Restore IDs/selection
  appState.nextRegionId =
    Number.isInteger(snap.nextRegionId) && snap.nextRegionId > 0
      ? snap.nextRegionId
      : (appState.regions.reduce((m, r) => Math.max(m, r.id), 0) + 1);

  appState.selectedRegionId =
    appState.regions.some((r) => r.id === snap.selectedRegionId)
      ? snap.selectedRegionId
      : null;

  // 5) Re-render UI
  renderRegionList();
  applyRegionActiveHighlight();
}