import express from 'express';
import { CentreService } from './centre.service.js';
import {
  createCentreSchema,
  centreIdParamSchema,
  paginationQuerySchema,
  addCentreTestSchema
} from './centre.schema.js';
import { authenticate, requireAdmin } from '../../plugins/auth.js';
import { asyncHandler } from '../../common/utils/async-handler.js';

const router = express.Router();

router.post('/centres', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const input = createCentreSchema.parse(req.body);
  const centre = await CentreService.createCentre(input);
  return res.status(201).json(centre);
}));

router.get('/centres', asyncHandler(async (req, res) => {
  const query = paginationQuerySchema.parse(req.query);
  const result = await CentreService.listCentres(query.page, query.limit);
  return res.status(200).json(result);
}));

router.get('/centres/:id', asyncHandler(async (req, res) => {
  const params = centreIdParamSchema.parse(req.params);
  const centre = await CentreService.getCentreById(params.id);
  return res.status(200).json(centre);
}));

router.post('/centres/:id/tests', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const params = centreIdParamSchema.parse(req.params);
  const input = addCentreTestSchema.parse(req.body);
  const centreTest = await CentreService.addTestToCentre(params.id, input);
  return res.status(201).json(centreTest);
}));

router.get('/centres/:id/tests', asyncHandler(async (req, res) => {
  const params = centreIdParamSchema.parse(req.params);
  const tests = await CentreService.getCentreTests(params.id);
  return res.status(200).json(tests);
}));

export const centreRouter = router;
