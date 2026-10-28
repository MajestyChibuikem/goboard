import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface AuthModalProps {
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose }) => {
  const { signInWithGoogle, signInWithGitHub } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithGoogle();
      onClose();
    } catch (err: any) {
      if (err.code === 'auth/redirect-cancelled-by-user') {
        setError('');
      } else {
        console.error('Google sign-in error:', err.code, err.message);
        setError('Google sign-in was interrupted. Please try again or continue with GitHub.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGitHubSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithGitHub();
      onClose();
    } catch (err: any) {
      if (err.code === 'auth/redirect-cancelled-by-user') {
        setError('');
      } else {
        console.error('GitHub sign-in error:', err.code, err.message);
        setError(err.message || 'GitHub sign-in was interrupted. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 14 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        className="relative bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-float w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 pb-2 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
              Welcome to GoBoard
            </h2>
            <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mt-1">
              Sign in to showcase your software, write on Lit Club, upvote innovations, and earn XP.
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={onClose}
            className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </motion.button>
        </div>

        <div className="p-6 space-y-3">
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 p-2.5 rounded-xl">
              {error}
            </p>
          )}

          {/* Social sign in */}
          <div className="space-y-2.5 pt-1">
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-xl text-sm font-semibold text-neutral-800 dark:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-750 hover:border-neutral-350 dark:hover:border-neutral-600 transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <button
              onClick={handleGitHubSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-neutral-900 dark:bg-neutral-800 text-white border border-transparent dark:border-neutral-700 rounded-xl text-sm font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-700 transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              Continue with GitHub
            </button>
          </div>

          <p className="text-[11px] text-center text-neutral-400 dark:text-neutral-500 pt-3">
            By signing in, you agree to student project showcase rules and fair gamification guidelines.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
};
