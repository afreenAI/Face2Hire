import { GoogleGenerativeAI } from '@google/generative-ai';

class AIService {
  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || '';
    this.genAI = new GoogleGenerativeAI(apiKey);

    if (apiKey) {
      this.model = this.genAI.getGenerativeModel({
        model: 'gemini-1.5-flash'
      });
    } else {
      this.model = null;
    }
  }

  /**
   * Generate interview questions.
   *
   * Each question also contains expected concepts/keywords.
   * These will later be used by the backend to evaluate answers.
   */
  async generateInterviewQuestions(
    role,
    jobDescription = '',
    questionCount = 5,
    difficulty = 'intermediate'
  ) {
    try {
      if (!this.model) {
        throw new Error('GEMINI_API_KEY is not configured');
      }

      const prompt = `Generate exactly ${questionCount} interview questions for a ${role} position.

${jobDescription ? `Job Description:
${jobDescription}` : ''}

Difficulty level: ${difficulty}

Requirements:
- Questions must be relevant to the ${role} role.
- If a job description is provided, make the questions relevant to it.
- Mix technical, behavioral, situational, experience-based, motivation, and career questions where appropriate.
- Questions must be clear and professional.
- Avoid duplicate or nearly identical questions.
- Each question must have 3 to 6 expected concepts that a good answer should cover.
- Expected concepts should describe ideas/concepts, not just isolated words.
- The expected concepts will be used later to evaluate the candidate's answer.
- Do not include the answer itself.

Return ONLY valid JSON.
Do not use markdown or code fences.

Format:
[
  {
    "text": "Question text here",
    "type": "technical|behavioral|experience|introduction|motivation|future-goals",
    "category": "personal|company-fit|behavioral|technical|career",
    "difficulty": "${difficulty}",
    "expectedConcepts": [
      "concept that a good answer should mention",
      "another important concept",
      "another relevant concept"
    ]
  }
]`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const cleanedText = text
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

      const questions = JSON.parse(cleanedText);

      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('Gemini returned an invalid question format');
      }

      return questions.map((q, index) => ({
        id: `ai-generated-${Date.now()}-${index}`,
        text: q.text,
        type: q.type || 'technical',
        category: q.category || 'technical',
        difficulty: q.difficulty || difficulty,
        expectedConcepts: Array.isArray(q.expectedConcepts)
          ? q.expectedConcepts
          : [],
        order: index + 1
      }));
    } catch (error) {
      console.error('Error generating questions with Gemini:', error);
      throw new Error('Failed to generate interview questions');
    }
  }

  /**
   * Analyze an answer using Gemini.
   *
   * IMPORTANT:
   * This method no longer generates confidence/nervousness scores.
   *
   * The actual content score will later be calculated by the backend
   * using the expected concepts stored with each question.
   *
   * This method is kept for constructive feedback only.
   */
  async analyzeResponse(question, response, role) {
    try {
      if (!this.model) {
        return {
          aiAnalysis: {
            feedback: 'AI feedback is currently unavailable.',
            suggestions: []
          }
        };
      }

      const prompt = `Give brief constructive feedback on this interview response.

Role: ${role}

Question:
${question}

Candidate Response:
${response}

Focus only on:
- clarity of the explanation
- whether the response is understandable
- one or two useful improvements

Do NOT provide:
- confidence score
- nervousness score
- overall score
- content score
- communication score
- numerical ratings

Return ONLY valid JSON in this format:
{
  "feedback": "Brief constructive feedback",
  "suggestions": [
    "Useful improvement 1",
    "Useful improvement 2"
  ]
}`;

      const result = await this.model.generateContent(prompt);
      const responseText = await result.response;
      const text = responseText.text();

      const cleanedText = text
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

      const analysis = JSON.parse(cleanedText);

      return {
        aiAnalysis: {
          feedback: analysis.feedback || '',
          suggestions: Array.isArray(analysis.suggestions)
            ? analysis.suggestions
            : []
        }
      };
    } catch (error) {
      console.error('Error generating response feedback with Gemini:', error);

      return {
        aiAnalysis: {
          feedback: 'AI feedback is temporarily unavailable.',
          suggestions: []
        }
      };
    }
  }

  /**
   * Generate overall interview feedback.
   *
   * This uses the completed interview responses and their
   * already-calculated scores.
   *
   * It does NOT calculate confidence or nervousness.
   */
  async generateOverallFeedback(responses, role) {
    try {
      if (!this.model) {
        return {
          summary: 'Overall AI feedback is currently unavailable.',
          strengths: [],
          improvements: [],
          recommendations: []
        };
      }

      const responsesText = responses
        .map(
          (r, i) =>
            `Question ${i + 1}: ${r.questionText}
Response: ${r.response}
Content Score: ${r.score ?? 'Not available'}/100`
        )
        .join('\n\n');

      const prompt = `Provide overall constructive feedback for an interview candidate applying for a ${role} position.

Interview responses:

${responsesText}

Focus on:
- strengths in the answers
- areas that need improvement
- practical recommendations
- overall quality of answers

Do not evaluate or generate:
- confidence
- nervousness
- personality
- mental state

Do not invent scores.

Return ONLY valid JSON:
{
  "summary": "Overall performance summary",
  "strengths": [
    "Strength 1",
    "Strength 2"
  ],
  "improvements": [
    "Improvement 1",
    "Improvement 2"
  ],
  "recommendations": [
    "Recommendation 1",
    "Recommendation 2"
  ]
}`;

      const result = await this.model.generateContent(prompt);
      const responseText = await result.response;
      const text = responseText.text();

      const cleanedText = text
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

      return JSON.parse(cleanedText);
    } catch (error) {
      console.error('Error generating overall feedback:', error);

      return {
        summary: 'Overall AI feedback is temporarily unavailable.',
        strengths: [],
        improvements: [],
        recommendations: []
      };
    }
  }

  /**
   * Extract skills and requirements from a job description.
   */
  async extractJobRequirements(jobDescription) {
    try {
      if (!this.model) {
        return {
          skills: [],
          requirements: [],
          qualifications: [],
          experience: 'Not specified'
        };
      }

      const prompt = `Extract key skills, requirements, and qualifications from this job description:

${jobDescription}

Return ONLY valid JSON:
{
  "skills": ["skill1", "skill2", "skill3"],
  "requirements": ["requirement1", "requirement2"],
  "qualifications": ["qualification1", "qualification2"],
  "experience": "required experience level"
}`;

      const result = await this.model.generateContent(prompt);
      const responseText = await result.response;
      const text = responseText.text();

      const cleanedText = text
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

      return JSON.parse(cleanedText);
    } catch (error) {
      console.error('Error extracting job requirements:', error);

      return {
        skills: [],
        requirements: [],
        qualifications: [],
        experience: 'Not specified'
      };
    }
  }
}

export default new AIService();