import { rm } from "node:fs/promises";
import { resolve } from "node:path";

import { resetConfigCache } from "../../config/src/index.js";
import { resetDbClient } from "../../db/src/index.js";
import { seedLocalData } from "./seed-local-data.js";

const TEST_DB_PATH = "./data/test.db";

async function removeIfExists(path: string) {
  await rm(path, { force: true });
}

export async function prepareTestDatabase() {
  process.env.DATABASE_URL = TEST_DB_PATH;
  resetConfigCache();
  resetDbClient();

  const absolutePath = resolve(process.cwd(), TEST_DB_PATH);
  await Promise.all([
    removeIfExists(absolutePath),
    removeIfExists(`${absolutePath}-shm`),
    removeIfExists(`${absolutePath}-wal`)
  ]);

  await seedLocalData();
}

export async function cleanupTestDatabase() {
  resetDbClient();
  const absolutePath = resolve(process.cwd(), TEST_DB_PATH);
  await Promise.all([
    removeIfExists(absolutePath),
    removeIfExists(`${absolutePath}-shm`),
    removeIfExists(`${absolutePath}-wal`)
  ]);
}
