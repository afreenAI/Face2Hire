// profileRoutes.js

import express from 'express';
import * as profileController from '../controllers/profileController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// All profile routes require authentication
router.use(protect);


// ==================== PROFILE ====================

router.get('/', profileController.getProfile);

router.put('/', profileController.updateProfile);


// ==================== PASSWORD ====================

router.put('/password', profileController.updatePassword);


// ==================== AVATAR ====================

router.put('/avatar', profileController.uploadAvatar);


// ==================== ACCOUNT ====================

router.delete('/', profileController.deleteAccount);


// ==================== DASHBOARD ====================

router.get('/dashboard', profileController.getDashboard);


export default router;