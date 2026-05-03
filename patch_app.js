// patch_app.js — Futtasd: node patch_app.js
const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "App.js");
let code = fs.readFileSync(filePath, "utf8");

// 1. Import csere
code = code.replace(
  `import VideoBackground  from "./src/components/VideoBackground";`,
  `import AnimatedBackground from "./src/components/AnimatedBackground";`
);

// 2. Wrapper logika csere
code = code.replace(
  `  // ✅ VideoBackground a HOME screenhez, ImageBackground a többihez\n  const Wrapper = screen === "home" ? VideoBackground : ImageBackground;\n  const wrapperProps = screen === "home"\n    ? { style: { flex: 1 } }\n    : { source: require("./assets/background.png"), style: { flex: 1 }, resizeMode: "cover" };`,
  `  // ✅ AnimatedBackground mindenhol\n  const Wrapper = AnimatedBackground;\n  const wrapperProps = { style: { flex: 1 } };`
);

fs.writeFileSync(filePath, code, "utf8");
console.log("✅ App.js sikeresen frissítve!");
console.log("   - VideoBackground → AnimatedBackground");
console.log("   - ImageBackground wrapper eltávolítva");
