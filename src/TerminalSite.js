import { useState, useRef, useEffect, useCallback } from "react";

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
    // fall back to Burlington silently
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

// ── static commands ───────────────────────────────────────────────────────────
const commands = {
  help: (
    <>
      available commands:
      <br />— about
      <br />— work
      <br />— contact
      <br />— weather
      <br />— clear
      <br />
    </>
  ),

  about: (
    <>
      I recently received my PhD studying climate dynamics with Kaighin McColl
      at Harvard University, and am now a post-doctoral fellow in the
      Department of Earth &amp; Planetary Sciences. My work focuses on climate
      over land: in particular, how warming impacts the terrestrial water cycle.
      <br /> <br />
      Before graduate school, I worked at a{" "}
      <a
        href="https://str.us/"
        className="underline text-blue-200"
        target="_blank"
        rel="noopener noreferrer"
      >
        tech company
      </a>{" "}
      in Boston and studied physics and music at Dartmouth
      College. I love to ski, read books, sing in choirs, and go on adventures,
      especially around Burlington, Vermont, where I grew up.
      <br /> <br />
      I am currently exploring opportunities at the intersection of climate science and industry (ideally in Europe). Please don't hesitate to reach out!
    </>
  ),

  work: (
    <>
      Water controls how energy moves throughout the climate system. In part
      because land surfaces can dry out, continents respond to changes quite
      differently than oceans do &mdash; but land-based climate systems remain
      understudied. Questions I think about include:
      <br /><br />
    <ul className="list-none space-y-2 ml-4">
      <li>— Do soils dry with warming, and if so, why?</li>
      <li>— How does precipitation respond to warming over land, and why is the response different over oceans?</li>
      <li>— How will warming alter continental water and energy budgets?</li>
      </ul>
    <br />
      Recent work was featured as a{" "}
      <a
        href="https://eos.org/research-spotlights/simplicity-may-be-the-key-to-understanding-soil-moisture"
        className="underline text-blue-200"
        target="_blank"
        rel="noopener noreferrer"
      >
        Research Spotlight
      </a>{" "}
      in Eos, and you can find additional publications at my{" "}
      <a
        href="https://scholar.google.com/citations?user=xqLNGGEAAAAJ&hl=en"
        className="underline text-blue-200"
        target="_blank"
        rel="noopener noreferrer"
      >
        Google Scholar
      </a>
      .
    </>
  ),

  contact: (
    <>
      email: tgallagher@g.harvard.edu
      <br />
      LinkedIn:{" "}
      <a
        href="https://www.linkedin.com/in/tara-e-gallagher/"
        className="underline text-blue-200"
        target="_blank"
        rel="noopener noreferrer"
      >
        linkedin.com/in/tara-e-gallagher/
      </a>
      <br />
      {/* GitHub:{" "}
      <a
        href="https://github.com/taragallagher"
        className="underline text-blue-200"
        target="_blank"
        rel="noopener noreferrer"
      >
        github.com/taragallagher
      </a> */}
    </>
  ),

  hello: <>Why hello! Learn more through 'help'.</>,

  // ── easter eggs ──────────────────────────────────────────────────────────────
  sudo: <>nice try.</>,

  vim: <>you're on your own.</>,

  ls: (
    <>
      about &nbsp; work &nbsp; contact &nbsp; weather &nbsp; clear
    </>
  ),

  whoami: <>I'm Tara, but who are you?</>,

  pwd: <>/home/tara/planet-earth</>,

  date: <>{new Date().toDateString()}</>,

  weather: "async",
};

// ── component ─────────────────────────────────────────────────────────────────
export default function TerminalSite() {
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState("");
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const outputRef = useRef(null);

  const addToHistory = useCallback((command, response) => {
    setHistory((prev) => [...prev, { command, response }]);
  }, []);

  const handleCommand = async (e) => {
    e.preventDefault();
    const trimmed = input.trim().toLowerCase();
    if (!trimmed) return;

    if (trimmed === "clear") {
      setHistory([]);
      setInput("");
      setHistoryIndex(-1);
      return;
    }

    setCommandHistory((prev) => [...prev, trimmed]);
    setHistoryIndex(-1);
    setInput("");

    // handle async weather command
    if (trimmed === "weather") {
      addToHistory(input, <>fetching weather...</>);
      try {
        const weatherResponse = await fetchWeather();
        setHistory((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { command: input, response: weatherResponse };
          return updated;
        });
      } catch {
        setHistory((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            command: input,
            response: <>could not fetch weather. try again later.</>,
          };
          return updated;
        });
      }
      return;
    }

    const response =
      commands[trimmed] ||
      (
        <>
          command not found: {trimmed}
          <br />
          Try 'help' for a list of available commands.
        </>
      );

    addToHistory(input, response);
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const newIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
      setHistoryIndex(newIndex);
      setInput(commandHistory[commandHistory.length - 1 - newIndex] || "");
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const newIndex = Math.max(historyIndex - 1, -1);
      setHistoryIndex(newIndex);
      setInput(
        newIndex === -1
          ? ""
          : commandHistory[commandHistory.length - 1 - newIndex]
      );
    }
  };

  useEffect(() => {
    if (outputRef.current) {
      const lastChild = outputRef.current.lastElementChild;
      if (lastChild) {
        lastChild.scrollIntoView({ behavior: "smooth", block: "end" });
      }
    }
  }, [history]);

  return (
    <div className="min-h-screen bg-slate-900 text-white rounded-none font-mono p-5 md:px-24 pb-10 flex flex-col items-center text-base">
      <div className="flex flex-col items-center mb-3 w-full max-w-3xl px-6">
        <h1 className="text-4xl font-normal mb-6">tara gallagher</h1>
        <img
          src="cat.jpg"
          alt="Tara w cat"
          className="w-60 h-60 rounded-full border-2 border-white mb-1"
        />
        <p className="text-center text-white text-base">
          Welcome! Type 'help' for available commands.
        </p>
      </div>
      <div className="bg-slate-900 shadow-lg px-10 w-full max-w-2xl h-[36rem] overflow-y-auto whitespace-pre-wrap">
        <div ref={outputRef}>
          {history.map((entry, idx) => (
            <div key={idx} className="mb-6">
              {entry.command && (
                <div className="text-blue-200 text-1xl">$ {entry.command}</div>
              )}
              <div className="text-white text-1xl">{entry.response}</div>
            </div>
          ))}
          <form onSubmit={handleCommand} className="flex items-center mt-6">
            <span className="text-blue-200 mr-4 text-1xl">$</span>
            <input
              className="flex-1 bg-transparent outline-none text-blue-200 caret-blue-200 text-1xl py-0 animate-pulse"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </form>
        </div>
      </div>
    </div>
  );
}