import { Router } from 'express';
import { checkDatabase } from '../config/db.js';

const router = Router();

router.get('/', async (req, res) => {
  let db = 'up';

  try {
    await checkDatabase();
  } catch {
    db = 'down';
  }

  const healthy = db === 'up';

  res.status(healthy ? 200 : 503).json({
    data: {
      status: healthy ? 'ok' : 'degraded',
      db,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;
