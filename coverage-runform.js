// Menghitung coverage khusus fungsi runForm.onsubmit (script.js baris 229-307) dari laporan lcov Node.
const { spawnSync } = require("node:child_process");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const [FROM, TO] = [229, 307];
const out = path.join(os.tmpdir(), "runtrack-lcov.info");
spawnSync(process.execPath, ["--test", "--experimental-test-coverage", "--test-coverage-include=script.js",
  "--test-reporter=lcov", `--test-reporter-destination=${out}`, "runtrack.test.js"], { stdio: "ignore" });
let lines = [], branches = [];
for (const l of fs.readFileSync(out, "utf8").split("\n")) {
  if (l.startsWith("DA:")) { const [n, c] = l.slice(3).split(",").map(Number); if (n >= FROM && n <= TO) lines.push(c); }
  if (l.startsWith("BRDA:")) { const [n, , , c] = l.slice(5).split(","); if (+n >= FROM && +n <= TO) branches.push(c); }
}
const cov = a => a.filter(c => c !== "-" && Number(c) > 0).length;
const pct = (a, b) => ((a / b) * 100).toFixed(2) + "%";
console.log(`Coverage runForm.onsubmit (script.js baris ${FROM}-${TO})`);
console.log(`Statement (line) : ${cov(lines)}/${lines.length} = ${pct(cov(lines), lines.length)}`);
console.log(`Branch           : ${cov(branches)}/${branches.length} = ${pct(cov(branches), branches.length)}`);
