import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function devApiPlugin(env: Record<string, string>): Plugin {
  const apiKey = env.GEMINI_API_KEY || '';
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

      server.middlewares.use('/api/xp-event', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const hasAdminCreds = Boolean(
              env.FIREBASE_SERVICE_ACCOUNT ||
              process.env.FIREBASE_SERVICE_ACCOUNT ||
              (env.FIREBASE_PRIVATE_KEY && env.FIREBASE_CLIENT_EMAIL) ||
              (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL)
            );

            if (hasAdminCreds) {
              if (env.FIREBASE_SERVICE_ACCOUNT && !process.env.FIREBASE_SERVICE_ACCOUNT) {
                process.env.FIREBASE_SERVICE_ACCOUNT = env.FIREBASE_SERVICE_ACCOUNT;
              }
              if (env.FIREBASE_PRIVATE_KEY && !process.env.FIREBASE_PRIVATE_KEY) {
                process.env.FIREBASE_PRIVATE_KEY = env.FIREBASE_PRIVATE_KEY;
              }
              if (env.FIREBASE_CLIENT_EMAIL && !process.env.FIREBASE_CLIENT_EMAIL) {
                process.env.FIREBASE_CLIENT_EMAIL = env.FIREBASE_CLIENT_EMAIL;
              }
              if (env.VITE_FIREBASE_PROJECT_ID && !process.env.VITE_FIREBASE_PROJECT_ID) {
                process.env.VITE_FIREBASE_PROJECT_ID = env.VITE_FIREBASE_PROJECT_ID;
              }

              const { default: xpEventHandler } = await server.ssrLoadModule('./api/xp-event.ts');

              const resWrapper = {
                status(code: number) {
                  res.statusCode = code;
                  return this;
                },
                json(data: any) {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(data));
                  return this;
                }
              };

              const parsedBody = body ? JSON.parse(body) : {};
              const reqWrapper = Object.assign(req, { body: parsedBody });
              return await xpEventHandler(reqWrapper, resWrapper);
            }

            res.statusCode = 503;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              error: 'Firebase Admin is not configured in local environment. XP event logged without local award.',
              awarded: 0
            }));
          } catch (e: any) {
            console.error('Dev XP Event Error:', e);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: e.message || 'Server error' }));
          }
        });
      });

      server.middlewares.use('/api/project-availability', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const hasAdminCreds = Boolean(
              env.FIREBASE_SERVICE_ACCOUNT ||
              process.env.FIREBASE_SERVICE_ACCOUNT ||
              (env.FIREBASE_PRIVATE_KEY && env.FIREBASE_CLIENT_EMAIL) ||
              (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL)
            );

            if (hasAdminCreds) {
              const { default: handler } = await server.ssrLoadModule('./api/project-availability.ts');
              const resWrapper = {
                status(code: number) {
                  res.statusCode = code;
                  return this;
                },
                json(data: any) {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(data));
                  return this;
                }
              };

              const parsedBody = body ? JSON.parse(body) : {};
              const reqWrapper = Object.assign(req, { body: parsedBody });
              return await handler(reqWrapper, resWrapper);
            }

            // Fallback for dev without admin credentials
            const parsedBody = body ? JSON.parse(body) : {};
            const cleanSlug = (parsedBody.title || 'project')
              .toLowerCase()
              .trim()
              .replace(/[^a-z0-9\s-]/g, '')
              .replace(/\s+/g, '-')
              .replace(/-+/g, '-');

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              available: true,
              titleTaken: false,
              slug: `${cleanSlug}-${Date.now().toString().slice(-4)}`
            }));
          } catch (e: any) {
            console.error('Dev project-availability error:', e);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: e.message || 'Server error' }));
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
        devApiPlugin(env)
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      optimizeDeps: {
        include: ['firebase/app', 'firebase/auth', 'firebase/firestore']
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (id.includes('node_modules')) {
                // Check icons before generic react check
                if (id.includes('lucide-react')) {
                  return 'vendor-icons';
                }
                // Framer Motion and animation runtime
                if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) {
                  return 'vendor-motion';
                }
                // Firebase Firestore
                if (id.includes('@firebase/firestore') || id.includes('firebase/firestore')) {
                  return 'vendor-firebase-firestore';
                }
                // Firebase Auth
                if (id.includes('@firebase/auth') || id.includes('firebase/auth')) {
                  return 'vendor-firebase-auth';
                }
                // Firebase Core & Utilities
                if (id.includes('firebase') || id.includes('@firebase')) {
                  return 'vendor-firebase-core';
                }
                // React core and routing
                if (
                  id.includes('react') ||
                  id.includes('react-dom') ||
                  id.includes('react-router') ||
                  id.includes('scheduler')
                ) {
                  return 'vendor-react';
                }
              }
            }
          }
        }
      }
    };
});
