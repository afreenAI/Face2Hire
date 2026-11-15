import User from '../models/User.js';
import Interview from '../models/Interview.js';


// ==================== GET PROFILE ====================

export const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select('-password -refreshToken');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    jobTitle: user.jobTitle,
                    industry: user.industry,
                    avatar: user.avatar,
                    role: user.role,
                    fullName: user.fullName,
                    createdAt: user.createdAt
                }
            }
        });
    } catch (error) {
        console.error('Get profile error:', error);

        res.status(500).json({
            success: false,
            message: 'Error fetching profile data'
        });
    }
};


// ==================== UPDATE PROFILE ====================

export const updateProfile = async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            jobTitle,
            industry
        } = req.body;

        const updateData = {};

        if (firstName) updateData.firstName = firstName;
        if (lastName) updateData.lastName = lastName;

        if (jobTitle !== undefined) {
            updateData.jobTitle = jobTitle;
        }

        if (industry !== undefined) {
            updateData.industry = industry;
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            updateData,
            {
                new: true,
                runValidators: true
            }
        ).select('-password -refreshToken');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                user: {
                    id: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    jobTitle: user.jobTitle,
                    industry: user.industry,
                    avatar: user.avatar,
                    role: user.role,
                    fullName: user.fullName,
                    createdAt: user.createdAt
                }
            }
        });
    } catch (error) {
        console.error('Update profile error:', error);

        res.status(500).json({
            success: false,
            message: 'Error updating profile'
        });
    }
};


// ==================== UPDATE PASSWORD ====================

export const updatePassword = async (req, res) => {
    try {
        const {
            currentPassword,
            newPassword
        } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current password and new password are required'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 6 characters long'
            });
        }

        const user = await User.findById(req.user.id)
            .select('+password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const isPasswordValid =
            await user.comparePassword(currentPassword);

        if (!isPasswordValid) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        user.password = newPassword;
        await user.save();

        res.json({
            success: true,
            message: 'Password updated successfully'
        });
    } catch (error) {
        console.error('Update password error:', error);

        res.status(500).json({
            success: false,
            message: 'Error updating password'
        });
    }
};


// ==================== UPLOAD AVATAR ====================

export const uploadAvatar = async (req, res) => {
    try {
        const { avatarUrl } = req.body;

        if (!avatarUrl) {
            return res.status(400).json({
                success: false,
                message: 'Avatar URL is required'
            });
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            {
                avatar: avatarUrl
            },
            {
                new: true
            }
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'Avatar updated successfully',
            data: {
                avatar: user.avatar
            }
        });
    } catch (error) {
        console.error('Upload avatar error:', error);

        res.status(500).json({
            success: false,
            message: 'Error uploading avatar'
        });
    }
};


// ==================== DELETE ACCOUNT ====================

export const deleteAccount = async (req, res) => {
    try {
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({
                success: false,
                message: 'Password is required to confirm account deletion'
            });
        }

        const user = await User.findById(req.user.id)
            .select('+password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const isPasswordValid =
            await user.comparePassword(password);

        if (!isPasswordValid) {
            return res.status(400).json({
                success: false,
                message: 'Password is incorrect'
            });
        }

        user.isActive = false;
        user.refreshToken = null;

        await user.save({
            validateBeforeSave: false
        });

        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');

        res.json({
            success: true,
            message: 'Account deleted successfully'
        });
    } catch (error) {
        console.error('Delete account error:', error);

        res.status(500).json({
            success: false,
            message: 'Error deleting account'
        });
    }
};


// ==================== GET DASHBOARD ====================

export const getDashboard = async (req, res) => {
    try {
        const userId = req.user.id;

        const interviews = await Interview.find({
            user: userId,
            status: 'completed',
            isActive: true
        })
            .sort({ 'metadata.completedAt': -1 })
            .lean();

        let totalScore = 0;
        let bestScore = 0;
        let totalInterviewTime = 0;

        const repairedInterviews = interviews.map((interview) => {
            let score = Number(
                interview.scores?.overall || 0
            );

            let contentScore = Number(
                interview.scores?.content || 0
            );

            /*
             * Repair old interviews whose score
             * was stored as zero.
             */
            if (
                score === 0 &&
                Array.isArray(interview.responses) &&
                interview.responses.length > 0
            ) {
                const responseScores = interview.responses
                    .map((response) =>
                        Number(
                            response.scores?.overall || 0
                        )
                    )
                    .filter((value) => value > 0);

                if (responseScores.length > 0) {
                    score = Math.round(
                        responseScores.reduce(
                            (sum, value) => sum + value,
                            0
                        ) / responseScores.length
                    );

                    contentScore = score;
                } else {
                    const fallbackScores = interview.responses.map(
                        (response) => {
                            /*
                             * Answers can be stored as strings OR
                             * as objects such as:
                             * { raw, cleaned, transcript }
                             *
                             * Convert whatever we receive into
                             * a safe string before using trim().
                             */
                            const answerValue =
                                response.response?.cleaned ??
                                response.response?.raw ??
                                response.response?.transcript ??
                                '';

                            let answer = '';

                            if (typeof answerValue === 'string') {
                                answer = answerValue;
                            } else if (
                                typeof answerValue === 'object' &&
                                answerValue !== null
                            ) {
                                if (
                                    typeof answerValue.text === 'string'
                                ) {
                                    answer = answerValue.text;
                                } else if (
                                    typeof answerValue.value === 'string'
                                ) {
                                    answer = answerValue.value;
                                } else {
                                    answer = JSON.stringify(
                                        answerValue
                                    );
                                }
                            }

                            const words = answer
                                .trim()
                                .split(/\s+/)
                                .filter(Boolean);

                            if (words.length === 0) {
                                return 0;
                            }

                            let depth = 35;

                            if (words.length >= 5) {
                                depth = 45;
                            }

                            if (words.length >= 10) {
                                depth = 60;
                            }

                            if (words.length >= 20) {
                                depth = 75;
                            }

                            if (words.length >= 35) {
                                depth = 88;
                            }

                            if (words.length >= 50) {
                                depth = 95;
                            }

                            let structure = 55;

                            if (words.length >= 10) {
                                structure = 70;
                            }

                            if (words.length >= 20) {
                                structure = 82;
                            }

                            if (words.length >= 35) {
                                structure = 90;
                            }

                            return Math.round(
                                depth * 0.7 +
                                structure * 0.3
                            );
                        }
                    );

                    const validScores = fallbackScores.filter(
                        (value) => value > 0
                    );

                    if (validScores.length > 0) {
                        score = Math.round(
                            validScores.reduce(
                                (sum, value) => sum + value,
                                0
                            ) / validScores.length
                        );

                        contentScore = score;
                    }
                }
            }

            let duration = Number(
                interview.metadata?.totalDuration || 0
            );

            if (
                duration === 0 &&
                interview.metadata?.startedAt &&
                interview.metadata?.completedAt
            ) {
                duration = Math.max(
                    0,
                    Math.round(
                        (
                            new Date(
                                interview.metadata.completedAt
                            ) -
                            new Date(
                                interview.metadata.startedAt
                            )
                        ) / 1000
                    )
                );
            }

            totalScore += score;

            bestScore = Math.max(
                bestScore,
                score
            );

            totalInterviewTime += duration;

            return {
                ...interview,

                scores: {
                    ...(interview.scores || {}),
                    overall: score,
                    content: contentScore
                },

                metadata: {
                    ...(interview.metadata || {}),
                    totalDuration: duration
                }
            };
        });

        const totalInterviews =
            repairedInterviews.length;

        const averageScore =
            totalInterviews > 0
                ? Math.round(
                    totalScore /
                    totalInterviews
                )
                : 0;

        const performanceInterviews =
            repairedInterviews
                .slice(0, 10)
                .reverse();

        const performanceData = {
            labels:
                performanceInterviews.map(
                    (interview) =>
                        interview.metadata?.completedAt
                            ? new Date(
                                interview.metadata.completedAt
                            ).toLocaleDateString(
                                'en-IN',
                                {
                                    day: 'numeric',
                                    month: 'short'
                                }
                            )
                            : ''
                ),

            overall:
                performanceInterviews.map(
                    (interview) =>
                        Number(
                            interview.scores?.overall || 0
                        )
                ),

            content:
                performanceInterviews.map(
                    (interview) =>
                        Number(
                            interview.scores?.content || 0
                        )
                )
        };

        const recentActivity =
            repairedInterviews
                .slice(0, 5)
                .map((interview) => ({
                    id: interview._id,

                    title:
                        interview.title ||
                        `${interview.role} Interview`,

                    role: interview.role,

                    score: Number(
                        interview.scores?.overall || 0
                    ),

                    completedAt:
                        interview.metadata?.completedAt ||
                        interview.updatedAt
                }));

        res.json({
            success: true,

            data: {
                stats: {
                    totalInterviews,
                    averageScore,
                    bestScore,
                    totalInterviewTime
                },

                performanceData,

                recentActivity
            }
        });

    } catch (error) {
        console.error(
            'Get dashboard error:',
            error
        );

        res.status(500).json({
            success: false,
            message:
                'Failed to load dashboard data'
        });
    }
};