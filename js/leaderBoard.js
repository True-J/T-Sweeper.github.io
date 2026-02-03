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
  const payload = {
    action: "submit",
    puzzle_id: puzzleId,
    initials,
    time_ms: String(timeMs),
    meta: meta ?? "",
    past_progress: Number(pastProgress ?? 0),
  };

  const body = new Blob([JSON.stringify(payload)], { type: "text/plain;charset=utf-8" });
  navigator.sendBeacon(ENDPOINT, body); // boolean: queued or not
  await new Promise((r) => setTimeout(r, 600));
  getTop10(puzzleId).then((data) => {
    if (data.ok) {
      renderLeaderBoard(data.top);
    } else {
      console.error("Failed to fetch top scores:", data.error);
    }
  });
}

export function renderLeaderBoard(scoresArray) {
  for (let i = 0; i < scoresArray.length; i++) {
    document.getElementById("name" + i).textContent = scoresArray[i].initials;
    const totalSec = Math.floor(scoresArray[i].time_ms / 1000);
    const hh = String(Math.floor(totalSec / 3600)).padStart(2, "0");
    const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
    const ss = String(totalSec % 60).padStart(2, "0");
    document.getElementById("time" + i).textContent = `${hh}:${mm}:${ss}`;
  }
  for (let i = scoresArray.length; i <= 9; i++) {
    document.getElementById("name" + i).textContent = "";
    document.getElementById("time" + i).textContent = "";
  }
}
