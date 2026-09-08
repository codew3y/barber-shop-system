import 'dotenv/config';
import { runJobs } from '../services/jobs';

// Manual/scheduled job runner: `npm run jobs`
// (Production schedulers — cron, Trigger.dev, etc. — can hit POST /api/v1/jobs/run.)
runJobs()
  .then((summary) => {
    console.log(JSON.stringify(summary));
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
