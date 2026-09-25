import express from 'express';
import { AuthService } from './auth.service.js';
import { signupSchema, loginSchema } from './auth.schema.js';
import { authenticate } from '../../plugins/auth.js';
import { asyncHandler } from '../../common/utils/async-handler.js';

const router = express.Router();

router.post('/auth/signup', asyncHandler(async (req, res) => {
  const input = signupSchema.parse(req.body);
  const result = await AuthService.signup(input);
  return res.status(201).json(result);
}));

router.post('/auth/login', asyncHandler(async (req, res) => {
  const input = loginSchema.parse(req.body);
  const result = await AuthService.login(input);
  return res.status(200).json(result);
}));

router.get('/auth/me', authenticate, asyncHandler(async (req, res) => {
  return res.status(200).json({ user: req.user });
}));

export const authRouter = router;
