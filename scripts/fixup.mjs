// Writes the per-directory module-type markers so Node interprets each build
// correctly regardless of the root package.json `type`. Zero dependencies.
import { writeFileSync } from "node:fs";

writeFileSync(new URL("../dist/esm/package.json", import.meta.url), JSON.stringify({ type: "module" }) + "\n");
writeFileSync(new URL("../dist/cjs/package.json", import.meta.url), JSON.stringify({ type: "commonjs" }) + "\n");
