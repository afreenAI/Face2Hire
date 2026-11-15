import Result from '../models/Result.js';
import Interview from '../models/Interview.js';


// ============================================================
// CREATE RESULT FROM COMPLETED INTERVIEW
// ============================================================
// Result is a snapshot of an Interview.
// Interview remains the source of truth.
// ============================================================
export const createResult = async (req, res) => {
    try {
        const userId = req.user.id;
        const { interviewId, title } = req.body;

        if (!interviewId) {
            return res.status(400).json({
                success: false,
                error: 'Interview ID is required'
            });
        }

        // Find interview owned by current user
        const interview = await Interview.findOne({
            _id: interviewId,
            user: userId
        });

        if (!interview) {
            return res.status(404).json({
                success: false,
                error: 'Interview not found'
            });
        }

        // Result should only exist for completed interviews
        if (interview.status !== 'completed') {
            return res.status(400).json({
                success: false,
                error: 'Result can only be created for a completed interview'
            });
        }

        // Prevent duplicate result for the same interview
        const existingResult = await Result.findOne({
            interview: interview._id,
            user: userId,
            isActive: true
        });

        if (existingResult) {
            await existingResult.populate(
                'interview',
                'title role company settings metadata'
            );

            return res.status(200).json({
                success: true,
                data: existingResult
            });
        }


        // --------------------------------------------------------
        // Create snapshot from Interview
        // --------------------------------------------------------
        const result = await Result.create({
            user: userId,

            interview: interview._id,

            title:
                title ||
                interview.title ||
                `${interview.role} Interview Result`,

            role: interview.role,

            company: interview.company,

            scores: {
                communication:
                    interview.scores?.communication || 0,

                content:
                    interview.scores?.content || 0,

                confidence:
                    interview.scores?.confidence || 0,

                nervousness:
                    interview.scores?.nervousness || 0,

                overall:
                    interview.scores?.overall || 0
            },

            feedback: interview.feedback,

            metrics: {
                totalQuestions:
                    interview.metrics?.totalQuestions || 0,

                answeredQuestions:
                    interview.metrics?.answeredQuestions || 0,

                averageResponseTime:
                    interview.metrics?.answeredQuestions > 0
                        ? (
                            interview.metrics.totalTime /
                            interview.metrics.answeredQuestions
                        )
                        : 0,

                totalDuration:
                    interview.metadata?.totalDuration || 0
            },

            responses: interview.responses || []
        });


        await result.populate(
            'interview',
            'title role company settings metadata'
        );


        res.status(201).json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('Create result error:', error);

        res.status(500).json({
            success: false,
            error: 'Failed to create result'
        });
    }
};


// ============================================================
// GET SPECIFIC RESULT
// ============================================================
export const getResult = async (req, res) => {
    try {
        const userId = req.user.id;
        const resultId = req.params.id;

        const result = await Result.findOne({
            _id: resultId,
            user: userId,
            isActive: true
        })
            .populate(
                'interview',
                'title role company settings metadata scores metrics'
            )
            .populate(
                'user',
                'firstName lastName email'
            );


        if (!result) {
            return res.status(404).json({
                success: false,
                error: 'Result not found'
            });
        }


        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('Get result error:', error);

        res.status(500).json({
            success: false,
            error: 'Failed to get result'
        });
    }
};


// ============================================================
// GET RESULT BY INTERVIEW ID
// ============================================================
export const getResultByInterview = async (req, res) => {
    try {
        const userId = req.user.id;
        const interviewId = req.params.interviewId;


        // Verify interview belongs to user
        const interview = await Interview.findOne({
            _id: interviewId,
            user: userId
        });

        if (!interview) {
            return res.status(404).json({
                success: false,
                error: 'Interview not found'
            });
        }


        const result = await Result.findOne({
            interview: interviewId,
            user: userId,
            isActive: true
        })
            .populate(
                'interview',
                'title role company settings metadata scores metrics'
            );


        if (!result) {
            return res.status(404).json({
                success: false,
                error: 'Result not found for this interview'
            });
        }


        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error(
            'Get result by interview error:',
            error
        );

        res.status(500).json({
            success: false,
            error: 'Failed to get result'
        });
    }
};


// ============================================================
// UPDATE RESULT
// ============================================================
// Scores, responses, metrics and feedback belong to Interview.
// Therefore they should not be independently modified here.
// ============================================================
export const updateResult = async (req, res) => {
    try {
        const userId = req.user.id;
        const resultId = req.params.id;

        const result = await Result.findOne({
            _id: resultId,
            user: userId,
            isActive: true
        });

        if (!result) {
            return res.status(404).json({
                success: false,
                error: 'Result not found'
            });
        }


        // Only allow changing the result title.
        if (
            req.body.title !== undefined &&
            typeof req.body.title === 'string'
        ) {
            result.title = req.body.title.trim();
        }


        await result.save();


        await result.populate(
            'interview',
            'title role company settings metadata scores metrics'
        );


        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('Update result error:', error);

        res.status(500).json({
            success: false,
            error: 'Failed to update result'
        });
    }
};


// ============================================================
// DELETE RESULT
// ============================================================
export const deleteResult = async (req, res) => {
    try {
        const userId = req.user.id;
        const resultId = req.params.id;


        const result = await Result.findOneAndUpdate(
            {
                _id: resultId,
                user: userId,
                isActive: true
            },
            {
                isActive: false
            },
            {
                new: true
            }
        );


        if (!result) {
            return res.status(404).json({
                success: false,
                error: 'Result not found'
            });
        }


        res.json({
            success: true,
            message: 'Result deleted successfully'
        });

    } catch (error) {
        console.error('Delete result error:', error);

        res.status(500).json({
            success: false,
            error: 'Failed to delete result'
        });
    }
};


// ============================================================
// GET USER RESULTS
// ============================================================
export const getUserResults = async (req, res) => {
    try {
        const userId = req.user.id;

        const page =
            Math.max(
                parseInt(req.query.page) || 1,
                1
            );

        const limit =
            Math.min(
                Math.max(
                    parseInt(req.query.limit) || 10,
                    1
                ),
                100
            );

        const skip = (page - 1) * limit;


        const results = await Result.find({
            user: userId,
            isActive: true
        })
            .populate(
                'interview',
                'title role company createdAt metadata.completedAt scores'
            )
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();


        const total = await Result.countDocuments({
            user: userId,
            isActive: true
        });


        res.json({
            success: true,

            data: results,

            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error(
            'Get user results error:',
            error
        );

        res.status(500).json({
            success: false,
            error: 'Failed to get results'
        });
    }
};


// ============================================================
// GET SHARED RESULT
// ============================================================
export const getSharedResult = async (req, res) => {
    try {
        const shareableLink =
            req.params.shareableLink;


        const result =
            await Result.getSharedResult(
                shareableLink
            );


        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error(
            'Get shared result error:',
            error
        );


        if (
            error.message ===
            'Result not found or expired'
        ) {
            return res.status(404).json({
                success: false,
                error: 'Result not found or has expired'
            });
        }


        res.status(500).json({
            success: false,
            error: 'Failed to get shared result'
        });
    }
};


// ============================================================
// SHARE RESULT
// ============================================================
export const shareResult = async (req, res) => {
    try {
        const userId = req.user.id;
        const resultId = req.params.id;


        const result =
            await Result.findOneAndUpdate(
                {
                    _id: resultId,
                    user: userId,
                    isActive: true
                },
                {
                    isPublic: true,

                    sharedAt: new Date(),

                    expiresAt:
                        new Date(
                            Date.now() +
                            30 *
                            24 *
                            60 *
                            60 *
                            1000
                        )
                },
                {
                    new: true,
                    runValidators: true
                }
            )
                .populate(
                    'interview',
                    'title role company'
                );


        if (!result) {
            return res.status(404).json({
                success: false,
                error: 'Result not found'
            });
        }


        res.json({
            success: true,

            data: {
                ...result.toObject(),

                shareUrl:
                    `${req.protocol}://${req.get('host')}/shared/${result.shareableLink}`
            }
        });

    } catch (error) {
        console.error(
            'Share result error:',
            error
        );

        res.status(500).json({
            success: false,
            error: 'Failed to share result'
        });
    }
};