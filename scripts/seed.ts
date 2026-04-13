import { seedLocalData } from "../packages/testing/src/seed-local-data.js";

async function seed() {
  await seedLocalData();
  console.log("Seeded local sandbox data.");
}

seed().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
