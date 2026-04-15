import { getConfig } from "../../../packages/config/src/index.js";
import { processPendingJobs } from "../../../packages/core/src/index.js";
import {
  createRuntimeProviderRegistry,
  ensureRuntimeBootstrap
} from "../../../packages/testing/src/bootstrap-local.js";

const config = getConfig();
const providerRegistry = createRuntimeProviderRegistry();

async function tick() {
  const processed = await processPendingJobs({ providerRegistry });
  if (processed.length > 0) {
    console.log(`Worker processed ${processed.length} job(s).`);
  }
}

async function start() {
  await ensureRuntimeBootstrap();
  console.log("Worker started.");
  await tick();
  setInterval(() => {
    tick().catch((error) => {
      console.error("Worker tick failed", error);
    });
  }, config.WORKER_POLL_INTERVAL_MS);
}

start().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
