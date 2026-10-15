// Copies the static assets Next's standalone server expects next to it.
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const pairs = [
  [path.join(root, ".next", "static"), path.join(root, ".next", "standalone", ".next", "static")],
  [path.join(root, "public"), path.join(root, ".next", "standalone", "public")],
];
for (const [from, to] of pairs) {
  if (!fs.existsSync(from)) continue;
  fs.rmSync(to, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
  console.log(`copied ${path.relative(root, from)} -> ${path.relative(root, to)}`);
}
