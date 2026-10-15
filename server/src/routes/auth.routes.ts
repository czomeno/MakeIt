import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { env } from '../config/env.js';
import { registerSchema, loginSchema, changePasswordSchema } from '../schemas/auth.schema.js';
import * as authController from '../controllers/auth.controller.js';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  // En tests, muchas peticiones legítimas pueden superar el límite en segundos.
  skip: () => env.NODE_ENV === 'test',
});

const router = Router();

router.use(authLimiter);

router.post('/register', validate({ body: registerSchema }), authController.register);
router.post('/login', validate({ body: loginSchema }), authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.post(
  '/password',
  requireAuth,
  validate({ body: changePasswordSchema }),
  authController.changePassword,
);
router.get('/me', requireAuth, authController.me);

export default router;
