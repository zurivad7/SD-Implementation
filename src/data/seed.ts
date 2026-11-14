// Loads seed.json once. It is bundled as text and parsed at start-up, so the app makes no
// network calls after the first page load (hard rule 7) and the type checker skips a 7 MB literal.
import raw from "./seed.json?raw";
import type { SeedData } from "./generator";

export const SEED_DATA: SeedData = JSON.parse(raw) as SeedData;
