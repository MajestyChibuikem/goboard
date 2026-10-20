import { GoogleGenAI, Type } from '@google/genai';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY is not configured on the server.'
    });
  }

  const { title, description, techStack, category } = req.body || {};
  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description are required.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `
      Analyze this student computer science project.
      Title: ${title}
      Description: ${description}
      Tech Stack: ${Array.isArray(techStack) ? techStack.join(', ') : techStack || ''}
      Category: ${category || 'Web Development'}

      Provide a JSON response with the following fields:
      1. review: A 2-sentence professional constructive review.
      2. impact: One sentence on the potential real-world impact or academic value.
      3. suggestion: One specific technical or feature suggestion for the next version.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            review: { type: Type.STRING },
            impact: { type: Type.STRING },
            suggestion: { type: Type.STRING }
          },
          required: ['review', 'impact', 'suggestion']
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error('No response from AI model');

    return res.status(200).json(JSON.parse(text));
  } catch (error: any) {
    console.error('Server Gemini error:', error);
    return res.status(500).json({
      review: "Our AI analyst is currently offline. Great job on the project though!",
      impact: "This project likely addresses a key problem in its domain.",
      suggestion: "Consider documenting your API endpoints for better developer experience."
    });
  }
}
