import mongoose from 'mongoose';

const interviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required for interview']
    },

    title: {
      type: String,
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
      default: 'AI Interview'
    },

    type: {
      type: String,
      enum: ['ai-generated', 'jd-based', 'custom'],
      default: 'ai-generated',
      required: true
    },

    role: {
      type: String,
      required: [true, 'Role is required'],
      trim: true
    },

    company: {
      type: String,
      trim: true
    },

    jobDescription: {
      originalFile: {
        filename: String,
        originalName: String,
        mimeType: String,
        size: Number,
        path: String
      },

      extractedText: {
        type: String,
        maxlength: [10000, 'Job description text cannot exceed 10,000 characters']
      },

      requirements: [
        {
          type: String,
          trim: true
        }
      ],

      skills: [
        {
          type: String,
          trim: true
        }
      ]
    },

    settings: {
      avatar: {
        type: String,
        enum: ['female-1', 'male-1', 'diverse-1'],
        default: 'female-1'
      },

      voiceEnabled: {
        type: Boolean,
        default: true
      },

      difficulty: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced'],
        default: 'intermediate'
      },

      questionCount: {
        type: Number,
        min: 1,
        max: 20,
        default: 5
      },

      timeLimit: {
        type: Number,
        default: 0
      }
    },

    status: {
      type: String,
      enum: ['scheduled', 'in-progress', 'completed', 'abandoned'],
      default: 'scheduled'
    },

    // --------------------------------------------------
    // QUESTIONS
    // --------------------------------------------------

    questions: [
      {
        questionId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Question'
        },

        text: {
          type: String,
          required: true
        },

        type: {
          type: String,
          enum: [
            'introduction',
            'experience',
            'technical',
            'behavioral',
            'situational',
            'motivation',
            'future-goals'
          ],
          required: true
        },

        category: {
          type: String,
          enum: [
            'personal',
            'company-fit',
            'behavioral',
            'technical',
            'career'
          ],
          required: true
        },

        // Concepts expected in a good answer.
        // Used for keyword/concept-based evaluation.
        expectedConcepts: [
          {
            type: String,
            trim: true
          }
        ],

        order: {
          type: Number,
          required: true
        },

        askedAt: {
          type: Date
        }
      }
    ],

    // --------------------------------------------------
    // RESPONSES
    // --------------------------------------------------

    responses: [
      {
        questionId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Question'
        },

        response: {
          text: {
            type: String,
            required: true
          },

          audioFile: {
            filename: String,
            originalName: String,
            mimeType: String,
            size: Number,
            path: String,
            duration: Number
          },

          transcript: {
            raw: String,
            cleaned: String
          }
        },

        // Whether answer was typed or spoken.
        answerMode: {
          type: String,
          enum: ['typed', 'voice'],
          default: 'typed'
        },

        // ------------------------------------------------
        // RESPONSE METRICS
        // ------------------------------------------------

        metrics: {
          delivery: {
            pace: {
              type: Number,
              min: 0,
              max: 200
            },

            fillers: {
              type: Number,
              min: 0
            },

            clarity: {
              type: Number,
              min: 0,
              max: 100
            },

            energy: {
              type: Number,
              min: 0,
              max: 100
            },

            volume: {
              type: Number,
              min: 0,
              max: 100
            },

            pitch: {
              type: Number,
              min: 0,
              max: 500
            }
          },

          content: {
            relevance: {
              type: Number,
              min: 0,
              max: 100
            },

            completeness: {
              type: Number,
              min: 0,
              max: 100
            },

            structure: {
              type: Number,
              min: 0,
              max: 100
            },

            // Concepts found in the candidate's answer.
            matchedConcepts: [
              {
                type: String,
                trim: true
              }
            ],

            // Expected concepts not found in the answer.
            missedConcepts: [
              {
                type: String,
                trim: true
              }
            ]
          },

          // Long-pause information is only meaningful
          // for spoken answers.
          pauses: {
            count: {
              type: Number,
              min: 0,
              default: 0
            },

            totalDuration: {
              type: Number,
              min: 0,
              default: 0
            },

            longestPause: {
              type: Number,
              min: 0,
              default: 0
            }
          },

          aiAnalysis: {
            feedback: String,
            suggestions: [String]
          }
        },

        // ------------------------------------------------
        // RESPONSE SCORES
        // ------------------------------------------------

        scores: {
          communication: {
            type: Number,
            min: 0,
            max: 100,
            default: 0
          },

          content: {
            type: Number,
            min: 0,
            max: 100,
            default: 0
          },

          // Kept for future implementation.
          // Currently always 0.
          confidence: {
            type: Number,
            min: 0,
            max: 100,
            default: 0
          },

          // Kept for future implementation.
          // Currently always 0.
          nervousness: {
            type: Number,
            min: 0,
            max: 100,
            default: 0
          },

          overall: {
            type: Number,
            min: 0,
            max: 100,
            default: 0
          }
        },

        respondedAt: {
          type: Date,
          default: Date.now
        },

        duration: {
          type: Number,
          min: 0
        }
      }
    ],

    // --------------------------------------------------
    // INTERVIEW SCORES
    // --------------------------------------------------

    scores: {
      communication: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
      },

      content: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
      },

      // Reserved for future algorithm.
      confidence: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
      },

      // Reserved for future algorithm.
      nervousness: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
      },

      // Currently based on content correctness.
      overall: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
      }
    },

    // --------------------------------------------------
    // INTERVIEW METRICS
    // --------------------------------------------------

    metrics: {
      totalQuestions: {
        type: Number,
        default: 0
      },

      answeredQuestions: {
        type: Number,
        default: 0
      },

      averageScore: {
        type: Number,
        default: 0
      },

      totalTime: {
        type: Number,
        default: 0
      }
    },

    // --------------------------------------------------
    // FEEDBACK
    // --------------------------------------------------

    feedback: {
      summary: {
        type: String,
        maxlength: [1000, 'Summary cannot exceed 1000 characters']
      },

      strengths: [
        {
          type: String,
          trim: true
        }
      ],

      improvements: [
        {
          type: String,
          trim: true
        }
      ],

      recommendations: [
        {
          type: String,
          trim: true
        }
      ]
    },

    // --------------------------------------------------
    // METADATA
    // --------------------------------------------------

    metadata: {
      startedAt: {
        type: Date
      },

      completedAt: {
        type: Date
      },

      totalDuration: {
        type: Number,
        min: 0
      },

      pauses: [
        {
          startedAt: Date,
          endedAt: Date,
          duration: Number
        }
      ],

      browserInfo: {
        userAgent: String,
        language: String,
        platform: String
      },

      ipAddress: String
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// --------------------------------------------------
// INDEXES
// --------------------------------------------------

interviewSchema.index({ user: 1, status: 1 });
interviewSchema.index({ user: 1, createdAt: -1 });
interviewSchema.index({ status: 1, createdAt: -1 });
interviewSchema.index({ 'scores.overall': -1 });
interviewSchema.index({ role: 1 });

// --------------------------------------------------
// VIRTUALS
// --------------------------------------------------

interviewSchema.virtual('completionPercentage').get(function () {
  const questions = this.questions || [];
  const responses = this.responses || [];

  if (questions.length === 0) {
    return 0;
  }

  return Math.round((responses.length / questions.length) * 100);
});

interviewSchema.virtual('averageResponseTime').get(function () {
  const responses = this.responses || [];

  if (responses.length === 0) {
    return 0;
  }

  const totalTime = responses.reduce(
    (sum, response) => sum + (response.duration || 0),
    0
  );

  return Math.round(totalTime / responses.length);
});

// --------------------------------------------------
// PRE-SAVE
// --------------------------------------------------

interviewSchema.pre('save', function (next) {
  if (this.responses && this.responses.length > 0) {
    const avgCommunication =
      this.responses.reduce(
        (sum, response) => sum + (response.scores?.communication || 0),
        0
      ) / this.responses.length;

    const avgContent =
      this.responses.reduce(
        (sum, response) => sum + (response.scores?.content || 0),
        0
      ) / this.responses.length;

    // Confidence and nervousness are intentionally NOT
    // calculated yet. Their values remain 0 until proper
    // algorithms are implemented.

    const avgConfidence =
    this.responses.reduce(
        (sum, response) => sum + (response.scores?.confidence || 0),
        0
    ) / this.responses.length;

const avgOverall =
    this.responses.reduce(
        (sum, response) => sum + (response.scores?.overall || 0),
        0
    ) / this.responses.length;

this.scores.communication = Math.round(avgCommunication);
this.scores.content = Math.round(avgContent);
this.scores.confidence = Math.round(avgConfidence);
this.scores.nervousness = 0;
this.scores.overall = Math.round(avgOverall);

this.metrics.answeredQuestions = this.responses.length;
this.metrics.totalQuestions = this.questions.length;
this.metrics.averageScore = Math.round(avgOverall);
  }

  // ------------------------------------------------
  // COMPLETE INTERVIEW
  // ------------------------------------------------

  if (
    this.status === 'in-progress' &&
    this.completionPercentage === 100
  ) {
    this.status = 'completed';

    this.metadata.completedAt = new Date();

    if (this.metadata.startedAt) {
      this.metadata.totalDuration = Math.round(
        (this.metadata.completedAt - this.metadata.startedAt) / 1000
      );
    }
  }

  next();
});

// --------------------------------------------------
// USER INTERVIEW STATISTICS
// --------------------------------------------------

interviewSchema.statics.getUserStats = async function (userId) {
  const stats = await this.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        status: 'completed'
      }
    },

    {
      $group: {
        _id: null,

        totalInterviews: {
          $sum: 1
        },

        averageScore: {
          $avg: '$scores.overall'
        },

        bestScore: {
          $max: '$scores.overall'
        },

        totalTime: {
          $sum: {
            $ifNull: ['$metadata.totalDuration', 0]
          }
        },

        recentScores: {
          $push: {
            score: '$scores.overall',
            date: '$metadata.completedAt'
          }
        }
      }
    },

    {
      $project: {
        totalInterviews: 1,

        averageScore: {
          $round: ['$averageScore', 1]
        },

        bestScore: 1,

        totalTime: 1,

        recentScores: {
          $slice: ['$recentScores', -10]
        }
      }
    }
  ]);

  return (
    stats[0] || {
      totalInterviews: 0,
      averageScore: 0,
      bestScore: 0,
      totalTime: 0,
      recentScores: []
    }
  );
};

export default mongoose.model('Interview', interviewSchema);