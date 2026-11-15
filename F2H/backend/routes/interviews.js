import express from 'express';
import { body, validationResult } from 'express-validator';
import Interview from '../models/Interview.js';
import { protect } from '../middleware/authMiddleware.js';
import aiService from '../services/aiService.js';

const router = express.Router();

// ============================================================
// HELPER: NORMALIZE TEXT
// ============================================================
const normalizeText = (text = '') => {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

// ============================================================
// HELPER: CHECK WHETHER A CONCEPT IS PRESENT IN THE ANSWER
// ============================================================
const conceptMatchesAnswer = (concept, answer) => {
    const normalizedConcept = normalizeText(concept);
    const normalizedAnswer = normalizeText(answer);

    if (!normalizedConcept || !normalizedAnswer) {
        return false;
    }

    // Direct phrase match
    if (normalizedAnswer.includes(normalizedConcept)) {
        return true;
    }

    // Compare important words from the concept.
    // Small/common words are ignored.
    const conceptWords = normalizedConcept
        .split(' ')
        .filter(word => word.length >= 4);

    if (conceptWords.length === 0) {
        return false;
    }

    const matchedWords = conceptWords.filter(word =>
        normalizedAnswer.includes(word)
    );

    // A concept is considered matched when most of its
    // meaningful words appear in the answer.
    return matchedWords.length / conceptWords.length >= 0.6;
};

// ============================================================
// HELPER: EVALUATE ANSWER AGAINST EXPECTED CONCEPTS
// ============================================================
const evaluateContent = (answer, expectedConcepts = []) => {
    const concepts = Array.isArray(expectedConcepts)
        ? expectedConcepts.filter(Boolean)
        : [];

    if (!answer || !answer.trim()) {
        return {
            content: 0,
            relevance: 0,
            completeness: 0,
            structure: 0,
            matchedConcepts: [],
            missedConcepts: concepts
        };
    }

    // If no concepts were generated, don't pretend that
    // keyword evaluation was performed.
    if (concepts.length === 0) {
        return {
            content: 0,
            relevance: 0,
            completeness: 0,
            structure: 0,
            matchedConcepts: [],
            missedConcepts: [],
            evaluationAvailable: false
        };
    }

    const matchedConcepts = concepts.filter(concept =>
        conceptMatchesAnswer(concept, answer)
    );

    const missedConcepts = concepts.filter(
        concept => !matchedConcepts.includes(concept)
    );

    const completeness = Math.round(
        (matchedConcepts.length / concepts.length) * 100
    );

    // Relevance is based on whether the answer addresses
    // the concepts expected for this question.
    const relevance = completeness;

    // Basic structure indicator:
    // very short answers receive a lower structure score.
    const wordCount = normalizeText(answer).split(' ').filter(Boolean).length;

    let structure = 100;

    if (wordCount < 5) {
        structure = 40;
    } else if (wordCount < 10) {
        structure = 60;
    } else if (wordCount < 20) {
        structure = 80;
    }

    const content = Math.round(
        relevance * 0.6 +
        completeness * 0.3 +
        structure * 0.1
    );

    return {
        content,
        relevance,
        completeness,
        structure,
        matchedConcepts,
        missedConcepts,
        evaluationAvailable: true
    };
};

// ============================================================
// HELPER: ANALYZE LONG PAUSES FOR VOICE ANSWERS
// ============================================================
const analyzePauses = (metrics = {}) => {
    const pauses = Array.isArray(metrics.pauses)
        ? metrics.pauses
        : [];

    const longPauseThreshold = 2.5;

    const longPauses = pauses.filter(pause => {
        const duration =
            typeof pause === 'number'
                ? pause
                : Number(
                    pause?.duration ??
                    pause?.durationSeconds ??
                    pause?.seconds ??
                    0
                );

        return duration >= longPauseThreshold;
    });

    const totalPauseDuration = longPauses.reduce((total, pause) => {
        const duration =
            typeof pause === 'number'
                ? pause
                : Number(
                    pause?.duration ??
                    pause?.durationSeconds ??
                    pause?.seconds ??
                    0
                );

        return total + duration;
    }, 0);

    return {
        longPauseCount: longPauses.length,
        totalPauseDuration: Number(totalPauseDuration.toFixed(2)),
        longPauses
    };
};

// ============================================================
// GET ALL INTERVIEWS FOR CURRENT USER
// ============================================================
router.get('/', protect, async (req, res) => {
    try {
        const interviews = await Interview.find({
            user: req.user.id
        })
            .sort({ createdAt: -1 })
            .populate(
                'questions.questionId',
                'text type difficulty category'
            );

        res.json(interviews);
    } catch (err) {
        console.error('Get interviews error:', err);

        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// ============================================================
// GET SINGLE INTERVIEW
// ============================================================
router.get('/:id', protect, async (req, res) => {
    try {
        const interview = await Interview.findById(req.params.id)
            .populate(
                'questions.questionId',
                'text type difficulty category'
            )
            .populate('user', 'firstName lastName email');

        if (!interview) {
            return res.status(404).json({
                success: false,
                message: 'Interview not found'
            });
        }

        // Check ownership
        if (interview.user._id.toString() !== req.user.id) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized'
            });
        }

        res.json(interview);
    } catch (err) {
        console.error('Get interview error:', err);

        if (err.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Interview not found'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// ============================================================
// CREATE NEW INTERVIEW
// ============================================================
router.post(
    '/',
    [
        protect,
        [
            body('role', 'Role is required').not().isEmpty(),

            body('difficulty', 'Difficulty is required')
                .isIn(['Easy', 'Medium', 'Hard']),

            body('questionCount', 'Question count must be between 5 and 20')
                .isInt({ min: 5, max: 20 })
        ]
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);

            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const {
                role,
                difficulty,
                questionCount,
                customQuestions,
                jobDescription
            } = req.body;

            const normalizedDifficulty = ['Easy', 'Medium', 'Hard'].includes(
                difficulty
            )
                ? difficulty
                : 'Medium';

            const schemaDifficulty = {
                Easy: 'beginner',
                Medium: 'intermediate',
                Hard: 'advanced'
            }[normalizedDifficulty];

            // ----------------------------------------------------
            // Generate questions
            // ----------------------------------------------------
            let questions = [];

            if (customQuestions && customQuestions.length > 0) {
                questions = customQuestions.map((q, index) => ({
                    text: q.text,

                    type:
                        q.type === 'scenario'
                            ? 'situational'
                            : q.type || 'technical',

                    category: q.category || 'technical',

                    expectedConcepts: Array.isArray(q.expectedConcepts)
                        ? q.expectedConcepts
                        : [],

                    order: index + 1
                }));
            } else {
                try {
                    const aiQuestions =
                        await aiService.generateInterviewQuestions(
                            role,
                            jobDescription || '',
                            questionCount,
                            normalizedDifficulty.toLowerCase()
                        );

                    questions = aiQuestions.map((q, index) => ({
                        text: q.text,
                        type: q.type || 'technical',
                        category: q.category || 'technical',
                        expectedConcepts: Array.isArray(q.expectedConcepts)
                            ? q.expectedConcepts
                            : [],
                        order: index + 1
                    }));
                } catch (error) {
                    console.error(
                        'Error generating AI questions:',
                        error
                    );

                    // Fallback questions must respect the requested
                    // question count.
                    const fallbackQuestions = [
                        {
                            text: `Tell me about your experience with ${role} roles.`,
                            type: 'experience',
                            category: 'personal',
                            expectedConcepts: [
                                'relevant experience',
                                'technical skills',
                                'projects or practical work'
                            ]
                        },
                        {
                            text: `What interests you about working in ${role}?`,
                            type: 'motivation',
                            category: 'career',
                            expectedConcepts: [
                                'interest in the role',
                                'relevant skills',
                                'career goals'
                            ]
                        },
                        {
                            text: `What are your key strengths for a ${role} position?`,
                            type: 'behavioral',
                            category: 'personal',
                            expectedConcepts: [
                                'relevant strengths',
                                'supporting example',
                                'connection to the role'
                            ]
                        },
                        {
                            text: `Describe a project or task that is relevant to ${role}.`,
                            type: 'experience',
                            category: 'technical',
                            expectedConcepts: [
                                'project or task description',
                                'technical contribution',
                                'result or outcome'
                            ]
                        },
                        {
                            text: `How would you approach solving a challenging problem in a ${role} position?`,
                            type: 'situational',
                            category: 'technical',
                            expectedConcepts: [
                                'understanding the problem',
                                'structured approach',
                                'solution or implementation',
                                'evaluation of the result'
                            ]
                        }
                    ];

                    questions = Array.from(
                        { length: questionCount },
                        (_, index) => {
                            const template =
                                fallbackQuestions[
                                index % fallbackQuestions.length
                                ];

                            return {
                                ...template,
                                order: index + 1
                            };
                        }
                    );
                }
            }

            // ----------------------------------------------------
            // Create interview
            // ----------------------------------------------------
            const newInterview = new Interview({
                user: req.user.id,

                title: `${role} Interview`,

                type: jobDescription
                    ? 'jd-based'
                    : customQuestions && customQuestions.length > 0
                        ? 'custom'
                        : 'ai-generated',

                role,

                jobDescription: jobDescription
                    ? {
                        extractedText: jobDescription
                    }
                    : undefined,

                settings: {
                    difficulty: schemaDifficulty,
                    questionCount: questions.length
                },

                questions,

                status: 'in-progress',

                metadata: {
                    startedAt: new Date()
                },

                metrics: {
                    totalQuestions: questions.length,
                    answeredQuestions: 0,
                    averageScore: 0,
                    totalTime: 0
                }
            });

            const interview = await newInterview.save();

            await interview.populate(
                'questions.questionId',
                'text type difficulty category'
            );

            res.status(201).json(interview);
        } catch (err) {
            console.error('Create interview error:', err);

            res.status(500).json({
                success: false,
                message: 'Server error'
            });
        }
    }
);

// ============================================================
// SUBMIT RESPONSE FOR A QUESTION
// ============================================================
router.put(
    '/:id/response',
    [
        protect,

        [
            body('questionIndex', 'Question index is required')
                .isInt({ min: 0 }),

            body('response', 'Response is required')
                .not()
                .isEmpty()
        ]
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);

            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const {
                questionIndex,
                response,
                metrics = {},
                transcript = {},
                answerMode = 'typed'
            } = req.body;

            const normalizedResponse =
                typeof response === 'string'
                    ? response.trim()
                    : response?.text?.trim() || '';

            const normalizedTranscript = transcript || {};

            // ----------------------------------------------------
            // Find interview
            // ----------------------------------------------------
            const interview = await Interview.findById(req.params.id);

            if (!interview) {
                return res.status(404).json({
                    success: false,
                    message: 'Interview not found'
                });
            }

            // ----------------------------------------------------
            // Check ownership
            // ----------------------------------------------------
            if (interview.user.toString() !== req.user.id) {
                return res.status(401).json({
                    success: false,
                    message: 'Not authorized'
                });
            }

            // ----------------------------------------------------
            // Check question index
            // ----------------------------------------------------
            if (!interview.questions[questionIndex]) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid question index'
                });
            }

            const currentQuestion =
                interview.questions[questionIndex];

            // ----------------------------------------------------
            // Evaluate answer using expected concepts
            // ----------------------------------------------------
            const expectedConcepts =
                Array.isArray(currentQuestion.expectedConcepts)
                    ? currentQuestion.expectedConcepts
                    : [];

            const contentEvaluation = evaluateContent(
                normalizedResponse,
                expectedConcepts
            );

            // ----------------------------------------------------
            // Voice-specific pause analysis
            // ----------------------------------------------------
            const isVoiceAnswer =
                answerMode === 'voice' ||
                answerMode === 'spoken';

            const pauseAnalysis = isVoiceAnswer
                ? analyzePauses(metrics)
                : {
                    longPauseCount: 0,
                    totalPauseDuration: 0,
                    longPauses: []
                };

            // ----------------------------------------------------
            // Score
            //
            // For now, the score is based on content only.
            // Confidence and nervousness are NOT calculated.
            // ----------------------------------------------------
            const calculateFallbackScore = (questionText = '', answer = '') => {
                const normalizedAnswer = normalizeText(answer);

                if (!normalizedAnswer) return 0;

                const words = normalizedAnswer.split(' ').filter(Boolean);
                const wordCount = words.length;

                let depth = 35;

                if (wordCount >= 5) depth = 45;
                if (wordCount >= 10) depth = 60;
                if (wordCount >= 20) depth = 75;
                if (wordCount >= 35) depth = 88;
                if (wordCount >= 50) depth = 95;

                let structure = 55;

                if (wordCount >= 10) structure = 70;
                if (wordCount >= 20) structure = 82;
                if (wordCount >= 35) structure = 90;

                const questionWords = new Set(
                    normalizeText(questionText)
                        .split(' ')
                        .filter(word => word.length >= 4)
                );

                const answerWords = new Set(
                    words.filter(word => word.length >= 4)
                );

                const overlap = [...questionWords].filter(
                    word => answerWords.has(word)
                ).length;

                const relevance =
                    questionWords.size > 0
                        ? Math.min(
                            100,
                            Math.round(
                                (overlap /
                                    Math.min(questionWords.size, 6)) *
                                100
                            )
                        )
                        : 60;

                const relevanceScore = Math.max(50, relevance);

                return Math.max(
                    1,
                    Math.min(
                        100,
                        Math.round(
                            relevanceScore * 0.35 +
                            depth * 0.45 +
                            structure * 0.20
                        )
                    )
                );
            };


            const calculateCommunicationScore = (answer = '') => {
                const text = answer.trim();

                if (!text) return 0;

                const words = text.split(/\s+/);
                const wordCount = words.length;

                const sentences = text
                    .split(/[.!?]+/)
                    .filter(sentence => sentence.trim().length > 0);

                let score = 50;

                // Reward sufficiently developed answers.
                if (wordCount >= 15) score += 10;
                if (wordCount >= 30) score += 10;

                // Reward organized sentences.
                if (sentences.length >= 2) score += 10;
                if (sentences.length >= 3) score += 5;

                // Reward readable sentence lengths.
                const averageSentenceLength =
                    wordCount / Math.max(sentences.length, 1);

                if (averageSentenceLength >= 5 &&
                    averageSentenceLength <= 25) {
                    score += 10;
                }

                // Reward basic punctuation.
                if (/[.!?]/.test(text)) score += 5;

                return Math.min(100, score);
            };

            const calculateConfidenceScore = (answer = '') => {
                const text = answer.trim().toLowerCase();

                if (!text) return 0;

                let score = 70;

                const uncertaintyPhrases = [
                    'i am not sure',
                    "i'm not sure",
                    'maybe',
                    'perhaps',
                    'i guess',
                    'i think maybe',
                    'i might be wrong',
                    'i do not know',
                    "i don't know"
                ];

                uncertaintyPhrases.forEach(phrase => {
                    if (text.includes(phrase)) {
                        score -= 5;
                    }
                });

                const assertivePhrases = [
                    'i developed',
                    'i implemented',
                    'i created',
                    'i achieved',
                    'i successfully',
                    'i have experience',
                    'my approach',
                    'i am confident'
                ];

                assertivePhrases.forEach(phrase => {
                    if (text.includes(phrase)) {
                        score += 4;
                    }
                });

                return Math.max(0, Math.min(100, score));
            };


            const contentScore =
                contentEvaluation.evaluationAvailable
                    ? contentEvaluation.content
                    : calculateFallbackScore(
                        currentQuestion.text || '',
                        normalizedResponse
                    );


            const communicationScore =
                calculateCommunicationScore(normalizedResponse);

            const confidenceScore =
                calculateConfidenceScore(normalizedResponse);

            // Overall score: Content 60%, Communication 20%, Confidence 20%.
            const overallScore = Math.round(
                contentScore * 0.60 +
                communicationScore * 0.20 +
                confidenceScore * 0.20
            );

            const scores = {
                communication: communicationScore,
                content: contentScore,
                confidence: confidenceScore,
                nervousness: 0,
                overall: overallScore
            };


            // ----------------------------------------------------
            // AI feedback
            //
            // Gemini provides feedback only.
            // It does not determine numerical scores.
            // ----------------------------------------------------
            let aiAnalysis = {
                feedback: '',
                suggestions: []
            };

            try {
                const questionText =
                    currentQuestion.text || '';

                const analysis =
                    await aiService.analyzeResponse(
                        questionText,
                        normalizedResponse,
                        interview.role
                    );

                aiAnalysis = analysis.aiAnalysis || aiAnalysis;
            } catch (error) {
                console.error(
                    'Error getting AI feedback:',
                    error
                );
            }

            // ----------------------------------------------------
            // Calculate response duration
            // ----------------------------------------------------
            const responseDuration =
                Number(
                    metrics.duration ??
                    metrics.responseTime ??
                    0
                ) || 0;

            // ----------------------------------------------------
            // Add response to responses array
            // ----------------------------------------------------
            const responseObj = {
                questionId: currentQuestion._id,

                response: {
                    text: normalizedResponse,

                    transcript: {
                        raw:
                            normalizedTranscript.raw ||
                            normalizedResponse,

                        cleaned:
                            normalizedTranscript.cleaned ||
                            normalizedResponse
                    }
                },

                // Save whether the candidate answered by typing or speaking.
                answerMode: isVoiceAnswer ? 'voice' : 'typed',

                metrics: {
                    delivery: {
                        pace: Number(metrics.pace) || 0,
                        fillers: Number(metrics.fillers) || 0,
                        clarity: Number(metrics.clarity) || 0,
                        energy: Number(metrics.energy) || 0,
                        volume: Number(metrics.volume) || 0,
                        pitch: Number(metrics.pitch) || 0
                    },

                    pauses: {
                        count: pauseAnalysis.longPauseCount,

                        totalDuration:
                            pauseAnalysis.totalPauseDuration,

                        longestPause:
                            pauseAnalysis.longPauses.length > 0
                                ? Math.max(
                                    ...pauseAnalysis.longPauses.map(pause =>
                                        typeof pause === 'number'
                                            ? pause
                                            : Number(
                                                pause?.duration ??
                                                pause?.durationSeconds ??
                                                pause?.seconds ??
                                                0
                                            )
                                    )
                                )
                                : 0
                    },

                    content: {
                        relevance:
                            contentEvaluation.relevance,

                        completeness:
                            contentEvaluation.completeness,

                        structure:
                            contentEvaluation.structure,

                        matchedConcepts:
                            contentEvaluation.matchedConcepts,

                        missedConcepts:
                            contentEvaluation.missedConcepts
                    },

                    aiAnalysis: {
                        feedback:
                            aiAnalysis.feedback || '',

                        suggestions:
                            aiAnalysis.suggestions || [],

                        score: contentScore
                    }
                },

                scores,

                respondedAt: new Date(),

                duration: responseDuration
            };

            // ----------------------------------------------------
            // Prevent duplicate response for same question
            // ----------------------------------------------------
            const existingResponseIndex =
                interview.responses.findIndex(
                    r =>
                        r.questionId?.toString() ===
                        currentQuestion._id.toString()
                );

            if (existingResponseIndex >= 0) {
                interview.responses[existingResponseIndex] =
                    responseObj;
            } else {
                interview.responses.push(responseObj);
            }

            // ----------------------------------------------------
            // Update interview metrics
            // ----------------------------------------------------
            const answeredCount =
                interview.responses.length;

            const totalScore =
                interview.responses.reduce(
                    (sum, r) =>
                        sum + (r.scores?.overall || 0),
                    0
                );

            const averageScore =
                answeredCount > 0
                    ? totalScore / answeredCount
                    : 0;

            const totalTime =
                interview.responses.reduce(
                    (sum, r) =>
                        sum + (r.duration || 0),
                    0
                );

            interview.metrics.totalQuestions =
                interview.questions.length;

            interview.metrics.answeredQuestions =
                answeredCount;

            interview.metrics.averageScore =
                Math.round(averageScore);

            interview.metrics.totalTime =
                totalTime;

            // ----------------------------------------------------
            // Calculate interview-level scores
            // ----------------------------------------------------
            const allResponses = interview.responses;

            const averageContent =
                allResponses.length > 0
                    ? allResponses.reduce(
                        (sum, r) =>
                            sum + (r.scores?.content || 0),
                        0
                    ) / allResponses.length
                    : 0;

            interview.scores.content =
                Math.round(averageContent);

            interview.scores.overall =
                Math.round(averageContent);

            // Confidence and nervousness intentionally remain
            // unset/zero until a proper model is implemented.
            interview.scores.confidence = 0;
            interview.scores.nervousness = 0;
            interview.scores.communication = 0;

            // ----------------------------------------------------
            // Complete interview if all questions answered
            // ----------------------------------------------------
            if (
                answeredCount >=
                interview.questions.length
            ) {
                interview.status = 'completed';

                interview.metadata.completedAt =
                    new Date();

                if (interview.metadata.startedAt) {
                    interview.metadata.totalDuration =
                        Math.round(
                            (
                                interview.metadata.completedAt -
                                interview.metadata.startedAt
                            ) / 1000
                        );
                }
            } else {
                interview.status = 'in-progress';
            }

            // ----------------------------------------------------
            // Save interview
            // ----------------------------------------------------
            await interview.save();

            await interview.populate(
                'questions.questionId',
                'text type difficulty category'
            );

            // ----------------------------------------------------
            // Find next question
            // ----------------------------------------------------
            const nextQuestionIndex =
                questionIndex + 1;

            const hasNextQuestion =
                nextQuestionIndex <
                interview.questions.length;

            const nextQuestion =
                hasNextQuestion
                    ? interview.questions[nextQuestionIndex]
                    : null;

            res.json({
                success: true,

                interview,

                evaluation: {
                    answerMode,

                    contentScore,

                    relevance:
                        contentEvaluation.relevance,

                    completeness:
                        contentEvaluation.completeness,

                    structure:
                        contentEvaluation.structure,

                    matchedConcepts:
                        contentEvaluation.matchedConcepts,

                    missedConcepts:
                        contentEvaluation.missedConcepts,

                    longPauseCount:
                        pauseAnalysis.longPauseCount,

                    totalPauseDuration:
                        pauseAnalysis.totalPauseDuration,

                    aiFeedback: aiAnalysis
                },

                nextQuestion: hasNextQuestion
                    ? {
                        index: nextQuestionIndex,
                        text: nextQuestion.text,
                        type: nextQuestion.type,
                        category: nextQuestion.category,
                        order: nextQuestion.order
                    }
                    : null,

                completed:
                    interview.status === 'completed'
            });
        } catch (err) {
            console.error(
                'Submit response error:',
                err
            );

            res.status(500).json({
                success: false,
                message: 'Server error'
            });
        }
    }
);

// ============================================================
// PAUSE INTERVIEW
// ============================================================
router.put('/:id/pause', protect, async (req, res) => {
    try {
        const interview =
            await Interview.findById(req.params.id);

        if (!interview) {
            return res.status(404).json({
                success: false,
                message: 'Interview not found'
            });
        }

        if (interview.user.toString() !== req.user.id) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized'
            });
        }

        // The schema has no "paused" status.
        // Keep the interview in progress.
        if (interview.status === 'in-progress') {
            interview.status = 'in-progress';
            await interview.save();
        }

        res.json(interview);
    } catch (err) {
        console.error(
            'Pause interview error:',
            err
        );

        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// ============================================================
// RESUME INTERVIEW
// ============================================================
router.put('/:id/resume', protect, async (req, res) => {
    try {
        const interview =
            await Interview.findById(req.params.id);

        if (!interview) {
            return res.status(404).json({
                success: false,
                message: 'Interview not found'
            });
        }

        if (interview.user.toString() !== req.user.id) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized'
            });
        }

        if (interview.status === 'in-progress') {
            interview.status = 'in-progress';
            await interview.save();
        }

        res.json(interview);
    } catch (err) {
        console.error(
            'Resume interview error:',
            err
        );

        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// ============================================================
// DELETE INTERVIEW
// ============================================================
router.delete('/:id', protect, async (req, res) => {
    try {
        const interview =
            await Interview.findById(req.params.id);

        if (!interview) {
            return res.status(404).json({
                success: false,
                message: 'Interview not found'
            });
        }

        if (interview.user.toString() !== req.user.id) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized'
            });
        }

        await Interview.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'Interview removed'
        });
    } catch (err) {
        console.error(
            'Delete interview error:',
            err
        );

        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

export default router;