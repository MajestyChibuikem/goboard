import { GoogleGenAI, Type } from "@google/genai";
import { Project, GeminiInsight } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const generateProjectInsight = async (project: Project): Promise<GeminiInsight> => {
  if (!apiKey) {
    // Fallback for development if API key is missing (though prompt implies it's available)
    return {
      review: "API Key missing. Please configure the environment variable.",
      impact: "Cannot analyze impact.",
      suggestion: "Please add an API Key."
    };
  }

  try {
    const prompt = `
      Analyze this student computer science project.
      Title: ${project.title}
      Description: ${project.description}
      Tech Stack: ${project.techStack.join(', ')}
      Category: ${project.category}

      Provide a JSON response with the following fields:
      1. review: A 2-sentence professional constructive review.
      2. impact: One sentence on the potential real-world impact or academic value.
      3. suggestion: One specific technical or feature suggestion for the next version.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            review: { type: Type.STRING },
            impact: { type: Type.STRING },
            suggestion: { type: Type.STRING }
          },
          required: ["review", "impact", "suggestion"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    return JSON.parse(text) as GeminiInsight;

  } catch (error) {
    console.error("Gemini API Error:", error);
    return {
      review: "Our AI analyst is currently offline. Great job on the project though!",
      impact: "This project likely addresses a key problem in its domain.",
      suggestion: "Consider documenting your API endpoints for better developer experience."
    };
  }
};
