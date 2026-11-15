import express from 'express';

import {
    createResult,
    getResult,
    getResultByInterview,
    updateResult,
    deleteResult,
    getUserResults,
    getSharedResult,
    shareResult
} from '../controllers/resultController.js';

import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();


// ============================================================
// PUBLIC ROUTE
// ============================================================

router.get('/shared/:shareableLink', getSharedResult);


// ============================================================
// PROTECTED ROUTES
// ============================================================

router.use(protect);


// Get all results / Create result
router.route('/')
    .get(getUserResults)
    .post(createResult);


// Get result by interview ID
// IMPORTANT: This must come BEFORE /:id
router.get(
    '/interview/:interviewId',
    getResultByInterview
);


// Get / Update / Delete specific result
router.route('/:id')
    .get(getResult)
    .put(updateResult)
    .delete(deleteResult);


// Share result
router.post(
    '/:id/share',
    shareResult
);


export default router;