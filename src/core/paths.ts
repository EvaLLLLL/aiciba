import { homedir } from 'os'
import { join } from 'path'

/** `AICIBA_HOME` relocates config and history — used by tests, handy for portable installs. */
export const DATA_DIR =
  process.env.AICIBA_HOME?.trim() || join(homedir(), '.aiciba')
