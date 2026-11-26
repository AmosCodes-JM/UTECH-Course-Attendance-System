// Public catalog routes used by the registration forms.
import { Router } from 'express';
import { z } from 'zod';
import * as catalog from '../controllers/catalogController.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../utils/validators.js';

export function createProgramRouter() {
  const router = Router();
  router.get('/', catalog.programs);
  router.get(
    '/:id/modules',
    validate({
      params: z.object({ id: idParam }),
      query: z.object({ semester: z.enum(['current', 'all']).default('current') }),
    }),
    catalog.programModules,
  );
  return router;
}

export function createSemesterRouter() {
  const router = Router();
  router.get('/current', catalog.currentSemester);
  return router;
}
