import { Project, GeminiInsight } from "../types";

export const generateProjectInsight = async (project: Project): Promise<GeminiInsight> => {
  try {
    const response = await fetch('/api/insight', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: project.title,
        description: project.description,
        techStack: project.techStack,
        category: project.category,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data as GeminiInsight;
  } catch (error) {
    console.error("Gemini Insight Error:", error);
    return {
      review: "Our AI analyst is currently offline. Great job on the project though!",
      impact: "This project likely addresses a key problem in its domain.",
      suggestion: "Consider documenting your API endpoints for better developer experience."
    };
  }
};
