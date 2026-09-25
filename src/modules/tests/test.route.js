import express from 'express';
import { TestService } from './test.service.js';
import {
  createTestSchema,
  testIdParamSchema,
  paginationQuerySchema
} from './test.schema.js';
import { asyncHandler } from '../../common/utils/async-handler.js';

const router = express.Router();

router.post('/tests', asyncHandler(async (req, res) => {
  const input = createTestSchema.parse(req.body);
  const test = await TestService.createTest(input);
  return res.status(201).json(test);
}));

router.get('/tests', asyncHandler(async (req, res) => {
  const query = paginationQuerySchema.parse(req.query);
  const result = await TestService.listTests(query.page, query.limit);
  return res.status(200).json(result);
}));

router.get('/tests/:id', asyncHandler(async (req, res) => {
  const params = testIdParamSchema.parse(req.params);
  const test = await TestService.getTestById(params.id);
  return res.status(200).json(test);
}));

export const testRouter = router;
