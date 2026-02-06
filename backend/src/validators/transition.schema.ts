import { z } from 'zod';

export const transitionSchema = z.object({
  targetStatus: z.enum([
    'entwurf',
    'optionen_sammeln',
    'abstimmen',
    'einwand_integration',
    'beendet',
  ]),
});
