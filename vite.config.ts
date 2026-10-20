import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function devApiPlugin(apiKey: string): Plugin {
  return {
    name: 'dev-api-server',
    configureServer(server) {
      server.middlewares.use('/api/insight', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const parsed = body ? JSON.parse(body) : {};
            if (!apiKey) {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                review: "GEMINI_API_KEY is not configured in local .env. Add it to enable AI insights.",
                impact: "This project likely addresses a key problem in its domain.",
                suggestion: "Consider documenting your API endpoints for better developer experience."
              }));
              return;
            }

            const { GoogleGenAI, Type } = await import('@google/genai');
            const ai = new GoogleGenAI({ apiKey });
            const prompt = `
              Analyze this student computer science project.
              Title: ${parsed.title}
              Description: ${parsed.description}
              Tech Stack: ${Array.isArray(parsed.techStack) ? parsed.techStack.join(', ') : parsed.techStack || ''}
              Category: ${parsed.category || 'Web Development'}

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

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(response.text || '{}');
          } catch (e: any) {
            console.error('Dev Gemini API Error:', e);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              review: "Our AI analyst is currently offline. Great job on the project though!",
              impact: "This project likely addresses a key problem in its domain.",
              suggestion: "Consider documenting your API endpoints for better developer experience."
            }));
          }
        });
      });
    }
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        tailwindcss(),
        devApiPlugin(env.GEMINI_API_KEY || '')
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      optimizeDeps: {
        include: ['firebase/app', 'firebase/auth', 'firebase/firestore']
      }
    };
});
