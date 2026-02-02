const ENDPOINT = "https://script.google.com/macros/s/AKfycbyvoBz7c9MAGu3DSD7PHJ3mY8nJphiPiXVdCK3vdaVfUfPEg3GUdtb9c6rotBI7fcxH/exec";

export async function getTop10(puzzleId) {
    const url = `${ENDPOINT}?action=top&puzzle_id=${encodeURIComponent(puzzleId)}`;
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        console.error('Failed to fetch top scores:', err);
        return { ok: false, top: [], error: err.message };
    }
}

export async function submitScore({ puzzleId, initials, timeMs, meta, pastProgress }) {
    try {
        const res = await fetch(ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify({ action: "submit", puzzle_id: puzzleId, initials, time_ms: timeMs, meta, past_progress: pastProgress })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        console.error('Failed to submit score:', err);
        throw err;
    }
}

/* Save to go into Google App Scripts */

const SHEET_NAME = "scores";
const IP_SHEET_NAME = "ip_tracking";
const MAX_PER_PUZZLE = 30;
const TOP_RETURN = 10;

function doGet(e) {
    const action = (e.parameter.action || "").toLowerCase();
    
    // Handle preflight requests
    if (e.requestMethod === "OPTIONS") {
        return ContentService
            .createTextOutput("")
            .setHeader("Access-Control-Allow-Origin", "*")
            .setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            .setHeader("Access-Control-Allow-Headers", "Content-Type");
    }
    
    if (action === "top") return handleTop(e);
    return json({ ok: false, error: "unknown_action" });
}

function doPost(e) {
    let body = {};
    try {
        body = JSON.parse(e.postData.contents || "{}");
    } catch (err) {
        return json({ ok: false, error: "invalid_json" }, 400);
    }

    // Handle preflight requests
    if (e.requestMethod === "OPTIONS") {
        return ContentService
            .createTextOutput("")
            .setHeader("Access-Control-Allow-Origin", "*")
            .setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            .setHeader("Access-Control-Allow-Headers", "Content-Type");
    }

    const clientIp = e.clientAddress || "unknown";
    const action = (body.action || "").toLowerCase();
    if (action === "submit") return handleSubmit(body, clientIp);
    return json({ ok: false, error: "unknown_action" }, 400);
}

function handleTop(e) {
    const puzzleId = sanitizePuzzleId(e.parameter.puzzle_id);
    if (!puzzleId) return json({ ok: false, error: "bad_puzzle_id" }, 400);

    const sheet = getSheet_();
    const values = sheet.getDataRange().getValues();
    
    // Find row for this puzzle
    let puzzleRow = null;
    for (let i = 0; i < values.length; i++) {
        if (values[i][0] === puzzleId) {
            puzzleRow = values[i];
            break;
        }
    }
    
    if (!puzzleRow) return json({ ok: true, puzzle_id: puzzleId, top: [] });
    
    // Parse entries: columns B, C, D (name, time, ip), E, F, G (name, time, ip), etc.
    const entries = [];
    for (let col = 1; col < puzzleRow.length; col += 3) {
        const name = puzzleRow[col];
        const time = puzzleRow[col + 1];
        if (name && time) {
            entries.push({ initials: name, time_ms: time });
        }
    }
    
    return json({ ok: true, puzzle_id: puzzleId, top: entries.slice(0, TOP_RETURN) });
}

function handleSubmit(body, clientIp) {
    const puzzleId = sanitizePuzzleId(body.puzzle_id);
    const initials = sanitizeInitials(body.initials);
    const timeMs = sanitizeTimeMs(body.time_ms);
    const pastProgress = typeof body.past_progress === "number" ? Math.floor(body.past_progress) : 0;
    
    if (!puzzleId) return json({ ok: false, error: "bad_puzzle_id" });
    if (!initials) return json({ ok: false, error: "bad_initials" });
    if (timeMs === null) return json({ ok: false, error: "bad_time" });

    const meta = sanitizeMeta(body.meta);
    
    // Store in scores sheet and IP sheet
    return submitScoreAndLog_(puzzleId, initials, timeMs, clientIp, meta, pastProgress);
}

function getSheet_() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    return sheet;
}

function json(obj, status) {
    return ContentService
        .createTextOutput(JSON.stringify(obj))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeader("Access-Control-Allow-Origin", "*")
        .setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        .setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sanitizePuzzleId(v) {
    if (typeof v !== "string") return null;
    const s = v.trim();
    // allow letters, numbers, underscore, dash, slash
    if (!/^[A-Za-z0-9_\-\/]{1,80}$/.test(s)) return null;
    return s;
}

function sanitizeInitials(v) {
    if (typeof v !== "string") return null;
    const s = v.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(s)) return null;

    // Lightweight “PG” filter: block obvious patterns (expand as you like)
    const banned = new Set(["DIE", "ASS", "FUC", "FUK", "FUQ", "FUX", "FCK", "COC", "COK", "COQ", "KOX", "KOC", "KOK", "KOQ", "CAC", "CAK", "CAQ", "KAC", "KAK", "KAQ", "DIC", "DIK", "DIQ", "DIX", "DCK", "PNS", "PSY", "FAG", "FGT", "NGR", "NIG", "CNT", "KNT", "SHT", "DSH", "TWT", "BCH", "CUM", "CLT", "KUM", "KLT", "SUC", "SUK", "SUQ", "SCK", "LIC", "LIK", "LIQ", "LCK", "JIZ", "JZZ", "GAY", "GEY", "GEI", "GAI", "VAG", "VGN", "SJV", "FAP", "PRN", "LOL", "JEW", "JOO", "GVR", "PUS", "PIS", "PSS", "SNM", "TIT", "FKU", "FCU", "FQU", "HOR", "SLT", "JAP", "WOP", "KIK", "KYK", "KYC", "KYQ", "DYK", "DYQ", "DYC", "KKK", "JYZ", "PRK", "PRC", "PRQ", "MIC", "MIK", "MIQ", "MYC", "MYK", "MYQ", "GUC", "GUK", "GUQ", "GIZ", "GZZ", "SEX", "SXX", "SXI", "SXE", "SXY", "XXX", "WAC", "WAK", "WAQ", "WCK", "POT", "THC", "VAJ", "VJN", "NUT", "STD", "LSD", "POO", "AZN", "PCP", "DMN", "ORL", "ANL", "ANS", "MUF", "MFF", "PHK", "PHC", "PHQ", "XTC", "TOK", "TOC", "TOQ", "MLF", "RAC", "RAK", "RAQ", "RCK", "SAC", "SAK", "SAQ", "PMS", "NAD", "NDZ", "NDS", "WTF", "SOL", "SOB", "FOB", "SFU"]);
    if (banned.has(s)) return null;

    return s;
}

function sanitizeTimeMs(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    const i = Math.floor(n);
    // clamp to something reasonable (e.g., 0.5s to 24h)
    if (i < 500 || i > 24 * 60 * 60 * 1000) return null;
    return i;
}

function sanitizeMeta(v) {
    if (v == null) return "";
    // Store a compact JSON string, limited size
    try {
        const s = JSON.stringify(v);
        return s.length > 500 ? s.slice(0, 500) : s;
    } catch {
        return "";
    }
}

function submitScoreAndLog_(puzzleId, initials, timeMs, clientIp, meta, pastProgress) {
    const sheet = getSheet_();
    const ipSheet = getIpSheet_();
    const now = new Date();
    
    // Find or create row for this puzzle in scores sheet
    const values = sheet.getDataRange().getValues();
    let puzzleRowIdx = -1;
    for (let i = 0; i < values.length; i++) {
        if (values[i][0] === puzzleId) {
            puzzleRowIdx = i + 1; // 1-indexed for Apps Script
            break;
        }
    }
    
    if (puzzleRowIdx === -1) {
        // Create new row
        puzzleRowIdx = values.length + 1;
        sheet.getRange(puzzleRowIdx, 1).setValue(puzzleId);
    }
    
    // Read current row to find insertion point and sort
    const rowData = sheet.getRange(puzzleRowIdx, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Parse entries: [name, time, ip], [name, time, ip], etc.
    const entries = [];
    for (let col = 1; col < rowData.length; col += 3) {
        if (rowData[col]) {
            entries.push({ name: rowData[col], time: rowData[col + 1], ip: rowData[col + 2] || "" });
        }
    }
    
    // Add new entry
    entries.push({ name: initials, time: timeMs, ip: clientIp });
    
    // Sort by time and keep top 30
    entries.sort((a, b) => a.time - b.time);
    entries.splice(MAX_PER_PUZZLE);
    
    // Write back to sheet
    const newRowData = [puzzleId];
    for (const entry of entries) {
        newRowData.push(entry.name, entry.time, entry.ip);
    }
    sheet.getRange(puzzleRowIdx, 1, 1, newRowData.length).setValues([newRowData]);
    
    // Log to IP sheet
    const difficulty = extractDifficulty_(puzzleId);
    ipSheet.appendRow([clientIp, puzzleId, difficulty, timeMs, initials, pastProgress, now]);
    
    return json({ ok: true, rank: entries.findIndex(e => e.name === initials && e.time === timeMs) + 1 });
}

function getIpSheet_() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(IP_SHEET_NAME);
    if (!sheet) {
        sheet = ss.insertSheet(IP_SHEET_NAME);
        sheet.appendRow(["IP Address", "Puzzle ID", "Difficulty", "Time MS", "Initials", "Past Progress", "Timestamp"]);
    }
    return sheet;
}

function extractDifficulty_(puzzleId) {
    // Infer difficulty from puzzle ID path if available
    // e.g., "Easy/Puzzle_0" -> "Easy"
    if (typeof puzzleId === "string" && puzzleId.includes("/")) {
        const parts = puzzleId.split("/");
        return parts[0]; // "Easy", "Hard", etc.
    }
    return "Unknown";
}
