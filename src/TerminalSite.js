import { useState, useRef, useEffect } from "react";

const commands = {
  about:  (
    <>
      I am a PhD candidate studying climate dynamics with Kaighin McColl at Harvard University. My research focuses on climate over land: in particular, how warming impacts the terrestrial water cycle.
      <br /> <br />
      Before graduate school, I worked at a small research company in Boston and studied physics and music at Dartmouth College. I love to ski, read books, sing in choirs, and go on adventures, especially around Burlington, Vermont, where I grew up.
    </>
  ),
  
  research:  (
    <>Water controls how energy moves throughout the climate system. In part because land surfaces can dry out, continents respond to changes quite differently than oceans do &mdash; but land-based climate systems remain understudied. Questions I think about include:
     <br /> <br />- How will warming alter continental water and energy budgets? <br />- Do soils dry with warming, and if so, why?<br />- How does precipitation change over land, and why is the response different over oceans?<br /> <br />
      Recent work was featured as a <a href="https://eos.org/research-spotlights/simplicity-may-be-the-key-to-understanding-soil-moisture" className="underline text-blue-200" target="_blank" rel="noopener noreferrer">
       Research Spotlight</a> in Eos, and you can find additional publications at my <a href="https://scholar.google.com/citations?user=xqLNGGEAAAAJ&hl=en" className="underline text-blue-200" target="_blank" rel="noopener noreferrer">
       Google Scholar</a>.
    </>
  ),

  contact: (
    <>
      email: tgallagher@g.harvard.edu
      <br />
      LinkedIn: <a href="https://www.linkedin.com/in/tara-e-gallagher/" className="underline text-blue-200" target="_blank" rel="noopener noreferrer">
      linkedin.com/in/tara-e-gallagher/</a>
    </>
  ),

  hello: (
    <>
      Why hello! Learn more by entering 'about', 'research', or 'contact'.
    </>
  ),
};

export default function TerminalSite() {
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState("");
  const outputRef = useRef(null);

  const handleCommand = (e) => {
    e.preventDefault();
    const trimmed = input.trim().toLowerCase();
    const response =
    commands[trimmed] || (
      <>
        command not found: {trimmed}
        <br />
        Try 'about', 'research', or 'contact'.
      </>
    );
    // const response = commands[trimmed] || `command not found: ${trimmed}`;
    setHistory((prev) => [...prev, { command: input, response }]);
    setInput("");
  };

  useEffect(() => {
    if (outputRef.current) {
      // Use smooth scroll and scroll into view for last child
      const container = outputRef.current;
      const lastChild = container.lastElementChild;
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
        <p className="text-center text-white text-base">Type 'about', 'research', or 'contact' and press Enter.</p>
      </div>
      <div className="bg-slate-900  shadow-lg px-10 w-full max-w-2xl h-[36rem] overflow-y-auto whitespace-pre-wrap">
        <div ref={outputRef}>
          {history.map((entry, idx) => (
            <div key={idx} className="mb-6">
              <div className="text-blue-200 text-1xl">$ {entry.command}</div>
              <div className="text-white text-1xl">{entry.response}</div>
            </div>
          ))}
          <form
            onSubmit={handleCommand}
            className="flex items-center mt-6"
          >
            <span className="text-blue-200 mr-4 text-1xl">$</span>
            <input
              className="flex-1 bg-transparent outline-none text-blue-200 caret-blue-200 text-1xl py-0 animate-pulse"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoFocus
            />
          </form>
        </div>
      </div>
    </div>
  );
}