module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // nested under `brand` so these don't shadow Tailwind's own
        // orange/blue/yellow scales
        brand: {
          darkblue: "#382f83", // page background
          teal: "#2596be", // commands, and command names mentioned in prose
          yellow: "#f6bd30", // guest@tara
          orange: "#e94020", // ~ and $ in the prompt, and links in prose
          blue: "#2c41ff",
        },
      },
      // a terminal cursor snaps on and off rather than fading, so the
      // keyframes jump instead of interpolating
      keyframes: {
        blink: {
          "0%, 50%": { opacity: "1" },
          "50.01%, 100%": { opacity: "0" },
        },
      },
      animation: {
        blink: "blink 1.06s infinite",
      },
    },
  },
  plugins: [],
}
