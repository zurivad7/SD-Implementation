import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// SPEC section 3: all engine files are pure functions with no React imports.
const dir = join(__dirname, "..", "src", "engine");

describe("engine purity", () => {
  it.each(readdirSync(dir).filter((f) => f.endsWith(".ts")))("%s imports no React and reads no clock", (file) => {
    const src = readFileSync(join(dir, file), "utf8");
    expect(src).not.toMatch(/from\s+["']react/);
    expect(src).not.toMatch(/Date\.now\(|new Date\(\)/); // time is always a parameter
  });
});
