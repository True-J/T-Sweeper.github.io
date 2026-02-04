const ENDPOINT = "https://script.google.com/macros/s/AKfycbwYwDEeU91U_GVphi6xBQVUjtHPqnmY9MPJnYyqOg8REt4R_rR4ENAC_RDI5UFdfOMo/exec";

export function getTop10(puzzleId) {
  return new Promise((resolve, reject) => {
    const callbackName =
      "ts_cb_" + Date.now() + "_" + Math.random().toString(16).slice(2);

    const script = document.createElement("script");

    window[callbackName] = (data) => {
      try { delete window[callbackName]; } catch { }
      try { script.remove(); } catch { }
      resolve(data);
    };

    script.onerror = () => {
      try { delete window[callbackName]; } catch { }
      try { script.remove(); } catch { }
      reject(new Error("JSONP script failed to load"));
    };

    script.src =
      `${ENDPOINT}?action=top&puzzle_id=${encodeURIComponent(puzzleId)}` +
      `&callback=${encodeURIComponent(callbackName)}`;

    document.head.appendChild(script);
  });
}

export async function submitScore({ puzzleId, initials, timeMs, meta, pastProgress }) {
  addScoreToLeaderBoard(initials, timeMs);
  const payload = {
    action: "submit",
    puzzle_id: puzzleId,
    initials,
    time_ms: timeMs,
    meta: meta ?? "",
    past_progress: Number(pastProgress ?? 0),
  };
  const bodyBlob = new Blob([JSON.stringify(payload)], { type: "text/plain;charset=utf-8" });
  navigator.sendBeacon(ENDPOINT, bodyBlob);
}

function addScoreToLeaderBoard(initals, timeMs) {
  let scoresArray = [];
  for (let i = 0; i < 10; i++) {
    const name = document.getElementById("name" + i).textContent;
    const time = document.getElementById("time" + i).textContent;
    if (name && time) {
      const [hh, mm, ss] = time.split(":").map(Number);
      const totalMs = ((hh * 3600) + (mm * 60) + ss) * 1000;
      scoresArray.push({ initials: name, time_ms: totalMs });
    }
  }
  scoresArray.push({ initials: initals, time_ms: timeMs });
  scoresArray.sort((a, b) => a.time_ms - b.time_ms);
  if (scoresArray.length > 10) {
    scoresArray = scoresArray.slice(0, 10);
  }
  renderLeaderBoard(scoresArray);
}

export function renderLeaderBoard(scoresArray) {
  for (let i = 0; i < scoresArray.length; i++) {
    document.getElementById("name" + i).textContent = scoresArray[i].initials;
    document.getElementById("name" + i + "m").textContent = scoresArray[i].initials;
    const totalSec = Math.floor(scoresArray[i].time_ms / 1000);
    const hh = String(Math.floor(totalSec / 3600)).padStart(2, "0");
    const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
    const ss = String(totalSec % 60).padStart(2, "0");
    document.getElementById("time" + i).textContent = `${hh}:${mm}:${ss}`;
    document.getElementById("time" + i + "m").textContent = `${hh}:${mm}:${ss}`;
  }
  for (let i = scoresArray.length; i <= 9; i++) {
    document.getElementById("name" + i).textContent = "";
    document.getElementById("time" + i).textContent = "";
    document.getElementById("name" + i + "m").textContent = "";
    document.getElementById("time" + i + "m").textContent = "";
  }
}
