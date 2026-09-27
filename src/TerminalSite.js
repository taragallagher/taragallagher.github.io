import { Children, useState, useRef, useEffect, useCallback } from "react";

// ── weather helper ────────────────────────────────────────────────────────────
const WMO_CODES = {
  0: "clear sky", 1: "mainly clear", 2: "partly cloudy", 3: "overcast",
  45: "foggy", 48: "foggy", 51: "light drizzle", 53: "drizzle",
  55: "heavy drizzle", 61: "light rain", 63: "rain", 65: "heavy rain",
  71: "light snow", 73: "snow", 75: "heavy snow", 77: "snow grains",
  80: "rain showers", 81: "rain showers", 82: "violent rain showers",
  85: "snow showers", 86: "heavy snow showers", 95: "thunderstorm",
  96: "thunderstorm w/ hail", 99: "thunderstorm w/ hail",
};

async function fetchWeather() {
  let lat = 44.48;
  let lon = -73.21;
  let locationName = "Burlington, VT";

  // try to get user location
  try {
    const pos = await new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
    );
    lat = pos.coords.latitude;
    lon = pos.coords.longitude;

    // reverse geocode with nominatim
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
    );
    const geoData = await geoRes.json();
    const city = geoData.address?.city || geoData.address?.town || geoData.address?.village;
    const state = geoData.address?.state;
    if (city) locationName = state ? `${city}, ${state}` : city;
  } catch {
    // fall back to Burlington
  }

  // fetch weather
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code` +
    `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`
  );
  const data = await res.json();
  const c = data.current;
  const desc = WMO_CODES[c.weather_code] ?? "unknown";

  return (
    <>
      {locationName}: {Math.round(c.temperature_2m)}°F, {desc}
      <br />
      wind: {Math.round(c.wind_speed_10m)} mph | humidity: {c.relative_humidity_2m}%
      <br />
      {c.weather_code >= 71 && c.weather_code <= 77 ? "⚠ check the snow report." : ""}
    </>
  );
}

// ── loading animation ─────────────────────────────────────────────────────────
const SPINNER = ["|", "/", "-", "\\"];
const BAR_WIDTH = 24;

// minimum time the loader stays on screen, so a fast response still reads as a
// download rather than a flicker
const MIN_LOAD_MS = 900;

const WEATHER_STEPS = [
  { label: "resolving location", from: 0, to: 30 },
  { label: "connecting to api.open-meteo.com", from: 30, to: 62 },
  { label: "receiving forecast", from: 62, to: 100, bar: true },
];

function bar(pct) {
  const filled = Math.round((pct / 100) * BAR_WIDTH);
  return `[${"#".repeat(filled)}${".".repeat(BAR_WIDTH - filled)}] ${String(pct).padStart(3)}%`;
}

// renders the step list for a given overall progress: finished steps collapse to
// "done", the current one animates, later ones aren't printed yet
function StepLines({ pct, frame }) {
  return (
    <>
      {WEATHER_STEPS.map((step) => {
        if (pct < step.from) return null;
        const done = pct >= step.to;
        const local = done
          ? 100
          : Math.round(((pct - step.from) / (step.to - step.from)) * 100);
        return (
          <div key={step.label}>
            {step.bar ? (
              <>
                {step.label} {bar(local)}
              </>
            ) : (
              <>
                {done ? "✓" : SPINNER[frame % SPINNER.length]} {step.label}
                {done ? "... done" : "..."}
              </>
            )}
          </div>
        );
      })}
    </>
  );
}

// climbs on its own up to 94% and waits there for the real response to land
function WeatherLoader() {
  const [pct, setPct] = useState(0);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setFrame((f) => f + 1);
      setPct((p) => Math.min(94, p + 2 + Math.floor(Math.random() * 6)));
    }, 90);
    return () => clearInterval(id);
  }, []);

  return <StepLines pct={pct} frame={frame} />;
}

// keeps the loader up for at least MIN_LOAD_MS from `started`
function holdLoader(started) {
  const remaining = MIN_LOAD_MS - (Date.now() - started);
  return remaining > 0
    ? new Promise((resolve) => setTimeout(resolve, remaining))
    : Promise.resolve();
}

// ── snow ──────────────────────────────────────────────────────────────────────
const SNOW_MS = 15000; // how long a storm keeps spawning flakes
const PILE_MAX = 32; // px of average depth; stays inside the terminal's pb-10
const COL_W = 2; // px per column of the snow pile
const SLOPE = 1; // max height step between columns before snow slides
const LAND_Z = 0.55; // flakes nearer than this land; farther ones fall behind the pile
const DEPOSIT = 1.6; // how much pile a landed flake adds, relative to its area

// one flake, drawn once and stamped at every size: a solid core with just a
// thin falloff at the rim, so it's crisp but not a jagged pixel dot
function makeFlakeSprite() {
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = 32;
  const s = sprite.getContext("2d");
  const g = s.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(255, 255, 255, 1)");
  g.addColorStop(0.7, "rgba(255, 255, 255, 1)");
  g.addColorStop(1, "rgba(255, 255, 255, 0)");
  s.fillStyle = g;
  s.fillRect(0, 0, 32, 32);
  return sprite;
}

// z is depth, 0 far to 1 near: nearer flakes are bigger, brighter, fall faster
// and catch more of the wind, which is what gives the scene parallax
function makeFlake(w) {
  const z = Math.random() ** 1.4; // more distant flakes than near ones
  return {
    x: -40 + Math.random() * (w + 80),
    y: -10,
    z,
    r: 0.6 + z * 2.6,
    a: 0.3 + z * 0.6,
    vy: 18 + z * 55 + Math.random() * 12,
    sway: 6 + z * 18,
    freq: 0.4 + Math.random() * 1.2,
    phase: Math.random() * Math.PI * 2,
  };
}

// A full-page canvas that never takes clicks. Flakes land on a heightmap that
// persists until unmounted (by `clear`); once the storm is over and the last
// flake settles, the animation loop stops and the pile just sits there.
function Snow({ storm }) {
  const canvasRef = useRef(null);
  const pile = useRef(null);
  const flakes = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const sprite = makeFlakeSprite();
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const startedAt = performance.now();
    let w = 0;
    let h = 0;
    let raf = 0;
    let last = startedAt;
    let spawnDebt = 0;

    const drawFlakes = (near) => {
      for (const f of flakes.current) {
        if (f.z >= LAND_Z !== near) continue;
        const size = f.r * 2.6;
        ctx.globalAlpha = f.a;
        ctx.drawImage(sprite, f.x - size / 2, f.y - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
    };

    // the surface as a smooth curve through the column midpoints
    const tracePile = () => {
      const p = pile.current;
      ctx.moveTo(0, h - p[0]);
      for (let i = 1; i < p.length; i++) {
        const x0 = (i - 1) * COL_W;
        ctx.quadraticCurveTo(x0, h - p[i - 1], x0 + COL_W / 2, h - (p[i - 1] + p[i]) / 2);
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      drawFlakes(false);

      // lit from above: bright at the crest, shading to a cold blue underneath
      const top = Math.max(4, ...pile.current);
      const g = ctx.createLinearGradient(0, h - top, 0, h);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.35, "#e6edf6");
      g.addColorStop(1, "#aebbd0");
      ctx.fillStyle = g;
      ctx.beginPath();
      tracePile();
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      tracePile();
      ctx.stroke();

      drawFlakes(true);
    };

    // resample the pile to the new width so a resize doesn't wipe it
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.ceil(w / COL_W) + 1;
      const old = pile.current;
      pile.current = Array.from({ length: n }, (_, i) =>
        old ? old[Math.floor((i * old.length) / n)] : 0
      );
      draw();
    };

    // snow slides downhill until no step is steeper than SLOPE
    const relax = () => {
      const p = pile.current;
      for (let pass = 0; pass < 3; pass++) {
        for (let i = 0; i < p.length - 1; i++) {
          const d = p[i] - p[i + 1];
          if (Math.abs(d) > SLOPE) {
            const m = (d - Math.sign(d) * SLOPE) / 2;
            p[i] -= m;
            p[i + 1] += m;
          }
        }
      }
    };

    const deposit = (f) => {
      const p = pile.current;
      const c = Math.round(f.x / COL_W);
      const spread = Math.max(1, Math.round(f.r / COL_W));
      const add = (DEPOSIT * Math.PI * f.r * f.r) / COL_W / (spread * 2 + 1);
      for (let i = c - spread; i <= c + spread; i++) {
        if (i >= 0 && i < p.length && p[i] < PILE_MAX + 8) p[i] += add;
      }
    };

    const meanDepth = () =>
      pile.current.reduce((a, b) => a + b, 0) / pile.current.length;

    const snowing = (elapsed) => elapsed < SNOW_MS && meanDepth() < PILE_MAX;

    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      const t = now / 1000;
      const elapsed = now - startedAt;
      last = now;

      if (snowing(elapsed)) {
        // the storm builds in, then tapers off, instead of switching on and off
        const intensity = Math.max(0, Math.min(1, elapsed / 2500, (SNOW_MS - elapsed) / 4000));
        spawnDebt += ((dt * w) / 6) * intensity;
        for (; spawnDebt >= 1; spawnDebt--) flakes.current.push(makeFlake(w));
      }

      // one wind for the whole scene, made of a few slow sines so it gusts and
      // shifts direction without ever repeating obviously
      const wind =
        14 * Math.sin(t * 0.11) +
        9 * Math.sin(t * 0.37 + 1.3) +
        4 * Math.sin(t * 0.9 + 2.1);

      const p = pile.current;
      flakes.current = flakes.current.filter((f) => {
        f.y += f.vy * dt;
        f.x += (wind * (0.3 + 0.7 * f.z) + Math.sin(f.phase + t * f.freq) * f.sway) * dt;
        if (f.x < -40) f.x += w + 80;
        else if (f.x > w + 40) f.x -= w + 80;

        // distant flakes pass behind the drift and out of frame
        if (f.z < LAND_Z) return f.y - f.r * 2 < h;

        const c = Math.round(f.x / COL_W);
        if (c < 0 || c >= p.length) return f.y < h;
        if (f.y + f.r * 0.7 < h - p[c]) return true;
        deposit(f);
        return false;
      });
      relax();
      draw();

      // storm over and everything has landed: stop animating, keep the pile
      if (flakes.current.length || snowing(elapsed)) {
        raf = requestAnimationFrame(tick);
      }
    };

    resize();
    window.addEventListener("resize", resize);

    if (reduced) {
      // no falling, just the settled drift
      const q = pile.current;
      for (let i = 0; i < q.length; i++) {
        q[i] = Math.max(q[i], PILE_MAX * (0.75 + 0.25 * Math.sin(i / 40)));
      }
      draw();
    } else {
      raf = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [storm]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 w-full h-full pointer-events-none z-10"
    />
  );
}

// a command name wherever it's mentioned in prose or listed
const Cmd = ({ children }) => (
  <span className="text-brand-teal">{children}</span>
);

// Prints its children one at a time, the way a shell streams output
function Printer({ children, interval = 150 }) {
  const items = Children.toArray(children);
  const [shown, setShown] = useState(() =>
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      ? items.length
      : 1
  );

  useEffect(() => {
    if (shown >= items.length) return;
    const id = setTimeout(() => setShown((n) => n + 1), interval);
    return () => clearTimeout(id);
  }, [shown, items.length, interval]);

  // follow the output down as it prints, otherwise long results stream in
  // below the fold
  useEffect(() => {
    const box = document.querySelector("[data-terminal]");
    if (box) box.scrollTop = box.scrollHeight;
  }, [shown]);

  return <>{items.slice(0, shown)}</>;
}

// ── static commands ───────────────────────────────────────────────────────────
const commands = {
  help: (
    <>
      available commands:
      <br />— <Cmd>about</Cmd>
      <br />— <Cmd>work</Cmd>
      <br />— <Cmd>contact</Cmd>
      <br />— <Cmd>weather</Cmd>
      <br />— <Cmd>snow</Cmd>
      <br />— <Cmd>clear</Cmd>
      <br />
    </>
  ),

  about: (
    <Printer>
      <p>
        I am a postdoctoral fellow in the
        Department of Earth &amp; Planetary Sciences at Harvard University, advised by Kaighin McColl. My work focuses on climate
        over land: in particular, how warming impacts the terrestrial water cycle.
      </p>
      <p className="mt-4">
        Before graduate school I worked at a{" "}
        <a
          href="https://str.us/"
          className="underline text-brand-orange"
          target="_blank"
          rel="noopener noreferrer"
        >
          tech company
        </a>{" "}
        in Boston and studied physics and music at Dartmouth
        College. I love to ski, read books, sing in choirs, and go on adventures,
        especially around Burlington, Vermont, where I grew up.
      </p>
    </Printer>
  ),

  work: (
    <Printer>
      <p>
        Water controls how energy moves throughout the climate system. In part
        because land surfaces can dry out, continents respond to changes quite
        differently than oceans do, but land-based climate systems remain
        understudied. Questions I think about include:
      </p>
      <p className="ml-4 mt-4">— Do soils dry with warming, and if so, why?</p>
      <p className="ml-4 mt-2">
        — How does precipitation respond to warming over land, and why is the response different over oceans?
      </p>
      <p className="ml-4 mt-2">
        — How will warming alter continental water and energy budgets?
      </p>
      <p className="mt-4">
      Recent work was featured as a{" "}
      <a
        href="https://eos.org/research-spotlights/simplicity-may-be-the-key-to-understanding-soil-moisture"
        className="underline text-brand-orange"
        target="_blank"
        rel="noopener noreferrer"
      >
        Research Spotlight
      </a>{" "}
      in Eos, and you can find additional publications at my{" "}
      <a
        href="https://scholar.google.com/citations?user=xqLNGGEAAAAJ&hl=en"
        className="underline text-brand-orange"
        target="_blank"
        rel="noopener noreferrer"
      >
        Google Scholar
      </a>
      .
      </p>
    </Printer>
  ),

  contact: (
    <>
      email: tgallagher@g.harvard.edu
      <br />
      LinkedIn:{" "}
      <a
        href="https://www.linkedin.com/in/tara-e-gallagher/"
        className="underline text-brand-orange"
        target="_blank"
        rel="noopener noreferrer"
      >
        linkedin.com/in/tara-e-gallagher/
      </a>
      <br />
      {/* GitHub:{" "}
      <a
        href="https://github.com/taragallagher"
        className="underline text-brand-orange"
        target="_blank"
        rel="noopener noreferrer"
      >
        github.com/taragallagher
      </a> */}
    </>
  ),

  hello: (
    <>
      Why hello! Learn more through <Cmd>'help'</Cmd>.
    </>
  ),

  sudo: <>nice try.</>,

  vim: <>you're on your own.</>,

  ls: (
    <>
      <Cmd>about</Cmd> &nbsp; <Cmd>work</Cmd> &nbsp; <Cmd>contact</Cmd> &nbsp;{" "}
      <Cmd>weather</Cmd> &nbsp; <Cmd>snow</Cmd> &nbsp; <Cmd>clear</Cmd>
    </>
  ),

  whoami: <>i'm tara, but who are you?</>,

  pwd: <>/home/tara/planet-earth</>,

  date: <>{new Date().toDateString()}</>,

  weather: "async",

  snow: <>It's snowing! <Cmd>'clear'</Cmd> to shovel.</>,
};

// shared by the echoed history lines and the live input, so the two can never
// drift out of alignment
function Prompt() {
  return (
    <>
      <span className="text-brand-yellow">guest@tara</span>
      <span className="ml-2 text-brand-orange">~</span>
      <span className="ml-2 text-brand-orange">$</span>
    </>
  );
}

// ── component ─────────────────────────────────────────────────────────────────
export default function TerminalSite() {
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState("");
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [caret, setCaret] = useState(0);
  // 0 = no snow; each `snow` bumps it to start another storm on the same pile
  const [storm, setStorm] = useState(0);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // the real <input> is transparent and only captures keystrokes; the visible
  // line is a mirror of its value, so `caret` has to follow selectionStart
  const syncCaret = (e) => setCaret(e.target.selectionStart ?? 0);

  const addToHistory = useCallback((command, response) => {
    setHistory((prev) => [...prev, { command, response }]);
  }, []);

  const handleCommand = async (e) => {
    e.preventDefault();
    const trimmed = input.trim().toLowerCase();
    if (!trimmed) return;

    if (trimmed === "clear") {
      setHistory([]);
      setStorm(0);
      setInput("");
      setCaret(0);
      setHistoryIndex(-1);
      return;
    }

    setCommandHistory((prev) => [...prev, trimmed]);
    setHistoryIndex(-1);
    setInput("");
    setCaret(0);

    // handle async weather command
    if (trimmed === "weather") {
      addToHistory(input, <WeatherLoader />);

      const replaceLast = (response) =>
        setHistory((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { command: input, response };
          return updated;
        });

      const started = Date.now();
      try {
        const weatherResponse = await fetchWeather();
        await holdLoader(started);
        // freeze the transcript at 100% so the scrollback keeps the download log
        replaceLast(
          <>
            <StepLines pct={100} frame={0} />
            <br />
            {weatherResponse}
          </>
        );
      } catch {
        await holdLoader(started);
        replaceLast(
          <>
            <div>{"✓"} resolving location... done</div>
            <div>{"✗"} connecting to api.open-meteo.com... failed</div>
            <br />
            could not fetch weather. try again later.
          </>
        );
      }
      return;
    }

    if (trimmed === "snow") setStorm((s) => s + 1);

    const response =
      commands[trimmed] ||
      (
        <>
          command not found: {trimmed}
          <br />
          Try <Cmd>'help'</Cmd> for a list of available commands.
        </>
      );

    addToHistory(input, response);
  };

  // recalling a command puts the caret at the end of it, as a shell does
  const recall = (value) => {
    setInput(value);
    setCaret(value.length);
    requestAnimationFrame(() => {
      inputRef.current?.setSelectionRange(value.length, value.length);
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const newIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
      setHistoryIndex(newIndex);
      recall(commandHistory[commandHistory.length - 1 - newIndex] || "");
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const newIndex = Math.max(historyIndex - 1, -1);
      setHistoryIndex(newIndex);
      recall(
        newIndex === -1
          ? ""
          : commandHistory[commandHistory.length - 1 - newIndex]
      );
    }
  };

  // clicking anywhere in the box focuses the prompt, like a real terminal —
  // but not when following a link, and not when the click ended a text
  // selection, which focusing would immediately clear
  const focusPrompt = (e) => {
    if (e.target.closest("a")) return;
    if (window.getSelection()?.toString()) return;
    inputRef.current?.focus();
  };

  // scroll the terminal box only — scrollIntoView would also scroll the window,
  // yanking the page down. No-op until output actually overflows the box.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history]);

  return (
    <div className="h-[100dvh] bg-brand-darkblue text-white rounded-none font-mono p-5 md:px-24 pb-10 flex flex-col items-center text-sm">
      {storm > 0 && <Snow storm={storm} />}
      <div className="shrink-0 flex flex-col items-center mb-3 w-full max-w-3xl px-6">
        {/* mobile-first: the header is compact by default and only grows at
            md, so it doesn't eat half a phone screen */}
        <h1 className="text-3xl md:text-4xl font-normal mb-3 md:mb-6">
          tara gallagher
        </h1>
        <img
          src="cat.jpg"
          alt="Tara w cat"
          className="w-32 h-32 md:w-60 md:h-60 rounded-full border-2 border-white mb-1"
        />
        <p className="text-center text-white text-sm">
          hi, i'm tara. welcome! type{" "}
          <span className="text-brand-teal">'help'</span> for available commands.
        </p>
      </div>
      <div
        ref={scrollRef}
        data-terminal
        onMouseUp={focusPrompt}
        className="bg-brand-darkblue px-10 w-full max-w-3xl flex-1 min-h-[16rem] overflow-y-auto whitespace-pre-wrap text-sm"
      >
        <div>
          {history.map((entry, idx) => (
            <div key={idx} className="mb-6">
              {entry.command && (
                <div className="flex items-center">
                  <Prompt />
                  <span className="ml-2 text-brand-teal">{entry.command}</span>
                </div>
              )}
              <div className="text-white">{entry.response}</div>
            </div>
          ))}
          <form onSubmit={handleCommand} className="flex items-center">
            <Prompt />
            <div className="relative flex-1 ml-2">
              {/* visible mirror of the input: a block cursor sits on the
                  character at the caret and inverts it, the way a shell does */}
              <div className="whitespace-pre text-brand-teal" aria-hidden="true">
                {input.slice(0, caret)}
                <span className="animate-blink bg-brand-teal text-brand-darkblue">
                  {input.slice(caret, caret + 1) || " "}
                </span>
                {input.slice(caret + 1)}
              </div>
              <input
                ref={inputRef}
                // text-base, not inherited: iOS Safari zooms the page when a
                // focused input is under 16px. It's invisible, so the size
                // only matters to Safari.
                className="absolute inset-0 w-full bg-transparent outline-none opacity-0 py-0 text-base"
                type="text"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  syncCaret(e);
                }}
                onSelect={syncCaret}
                onKeyUp={syncCaret}
                onKeyDown={handleKeyDown}
                autoFocus
              />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}