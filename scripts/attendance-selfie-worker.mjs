import { processQueuedAttendanceSelfies, readAttendanceSelfieConfig } from "./attendance-selfie-worker-lib.mjs";

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  const config = readAttendanceSelfieConfig();
  const maxChecks = config.maxChecks ?? 1;

  console.log(`Attendance selfie worker started with ${config.model}${config.dryRun ? " (dry run)" : ""}.`);

  const result = await processQueuedAttendanceSelfies({
    ...config,
    maxChecks,
  });

  for (const check of result.results) {
    if (check.status === "succeeded") {
      console.log(
        [
          `Check ${check.checkId}: ${check.overallStatus}`,
          `apron=${check.apronStatus}`,
          `headwear=${check.headwearStatus}`,
          `glove_thumbs_up=${check.gloveThumbsUpStatus}`,
          check.confidence === null ? null : `confidence=${check.confidence}`,
        ].filter(Boolean).join(" / "),
      );
    } else {
      console.log(`Check ${check.checkId}: failed / ${check.errorMessage}`);
    }
  }

  console.log(`Processed ${result.processed} attendance selfie check(s).`);
}
