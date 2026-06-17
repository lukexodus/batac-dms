import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'db.json');
const seedPath = path.join(__dirname, 'db.seed.json');

// If the seed file doesn't exist, we create it first from the current db.json
// This assumes the very first time you run this script, your db is in a "good" state.
if (!fs.existsSync(seedPath)) {
  if (fs.existsSync(dbPath)) {
    console.log("No seed file found. Creating db.seed.json from the current db.json as the master backup...");
    fs.copyFileSync(dbPath, seedPath);
    console.log("✅ Seed file created successfully!");
  } else {
    console.error("❌ Error: Neither db.json nor db.seed.json exists.");
    process.exit(1);
  }
} else {
  // If the seed file exists, we overwrite the current db.json with the seed
  console.log("Resetting db.json to match db.seed.json...");
  fs.copyFileSync(seedPath, dbPath);
  console.log("✅ Database reset successfully! You can now test your workflows again.");
}
