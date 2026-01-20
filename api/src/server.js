import app from './app.js';
import { config } from './config/env.js';

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`EPADLS API running on port ${PORT}`);
  console.log(`Environment: ${config.nodeEnv}`);
});
