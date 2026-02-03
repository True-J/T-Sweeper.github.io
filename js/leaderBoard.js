const ENDPOINT = "https://script.google.com/macros/s/AKfycby9kUQZ6iGHSMtRkmXrnq--puAnK2SSd95M84cbpKFExMcz9xQhzArtEMjlMpbEPP4u/exec";

export function getTop10(puzzleId) {
  return new Promise((resolve, reject) => {
    const callbackName =
      "ts_cb_" + Date.now() + "_" + Math.random().toString(16).slice(2);

    const script = document.createElement("script");

    window[callbackName] = (data) => {
      try { delete window[callbackName]; } catch {}
      try { script.remove(); } catch {}
      resolve(data);
    };

    script.onerror = () => {
      try { delete window[callbackName]; } catch {}
      try { script.remove(); } catch {}
      reject(new Error("JSONP script failed to load"));
    };

    script.src =
      `${ENDPOINT}?action=top&puzzle_id=${encodeURIComponent(puzzleId)}` +
      `&callback=${encodeURIComponent(callbackName)}`;

    document.head.appendChild(script);

    console.log("ENDPOINT:", ENDPOINT);
    console.log("JSONP URL:", script.src);
  });
}

export async function submitScore({ puzzleId, initials, timeMs, meta, pastProgress }) {
    try {
        const params = new URLSearchParams();
        params.append('action', 'submit');
        params.append('puzzle_id', puzzleId);
        params.append('initials', initials);
        params.append('time_ms', timeMs);
        params.append('meta', meta || '');
        params.append('past_progress', pastProgress);

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            },
            body: JSON.stringify(Object.fromEntries(params))
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return;
    } catch (err) {
        console.error('Failed to submit score:', err);
        throw err;
    }
}

export function renderLeaderBoard(scoresArray) {
    for (let i=0; i<scoresArray.length; i++) {
        document.getElementById("name" + i).textContent = scoresArray[i].initials;
        const totalSec = Math.floor(scoresArray[i].time_ms / 1000);
        const hh = String(Math.floor(totalSec / 3600)).padStart(2, "0");
        const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
        const ss = String(totalSec % 60).padStart(2, "0");
        document.getElementById("time" + i).textContent = `${hh}:${mm}:${ss}`;
    }
    for (let i=scoresArray.length; i<=9; i++) {
        document.getElementById("name" + i).textContent = "";
        document.getElementById("time" + i).textContent = "";
    }
}
