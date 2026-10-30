import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Project } from '../types';
import {
  X,
  GitPullRequest,
  Github,
  GitFork,
  Terminal,
  Copy,
  Check,
  ExternalLink,
  Send,
  Loader2,
  Sparkles,
  HeartHandshake,
} from 'lucide-react';

interface ContributeModalProps {
  project: Project;
  onClose: () => void;
  onNotifyAuthor: (prUrlOrTitle: string) => Promise<void>;
  isAuthor: boolean;
  currentUserDisplayName?: string;
}

export const ContributeModal: React.FC<ContributeModalProps> = ({
  project,
  onClose,
  onNotifyAuthor,
  isAuthor,
}) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [prUrlOrTitle, setPrUrlOrTitle] = useState('');
  const [sendingNotification, setSendingNotification] = useState(false);
  const [notificationSent, setNotificationSent] = useState(false);

  const rawRepo = project.repoUrl || project.githubMeta?.fullName || '';
  const repoFullName = rawRepo.replace(/^https?:\/\/github\.com\//i, '').replace(/\/+$/, '');
  const repoName = repoFullName.split('/')[1] || project.title.toLowerCase().replace(/\s+/g, '-');
  const forkUrl = repoFullName ? `https://github.com/${repoFullName}/fork` : undefined;
  const compareUrl = repoFullName ? `https://github.com/${repoFullName}/compare` : undefined;

  const cloneCommands = `# 1. Clone your fork and enter the directory
git clone https://github.com/YOUR_GITHUB_USERNAME/${repoName}.git
cd ${repoName}

# 2. Create a new feature branch for your improvements
git checkout -b feat/my-contribution`;

  const pushCommands = `# 3. Stage and commit your changes
git add .
git commit -m "feat: improve frontend layout and responsiveness"

# 4. Push your branch to your GitHub fork
git push origin feat/my-contribution`;

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prUrlOrTitle.trim()) return;
    setSendingNotification(true);
    try {
      await onNotifyAuthor(prUrlOrTitle.trim());
      setNotificationSent(true);
      setPrUrlOrTitle('');
    } catch {
      // Error handled by parent
    } finally {
      setSendingNotification(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className="w-full max-w-2xl max-h-[90vh] bg-white dark:bg-neutral-950 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-2xl flex flex-col overflow-hidden text-neutral-900 dark:text-neutral-100"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-4 bg-neutral-50/70 dark:bg-neutral-900/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
              <GitPullRequest className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight truncate">
                  Contribute to {project.title}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shrink-0">
                  +40 XP
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                Fork, submit a pull request on GitHub, and get recognized as a verified contributor.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-neutral-200/70 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Author Needs Banner */}
          {(project.contributionNeedsNote || (project.contributionAreas && project.contributionAreas.length > 0)) && (
            <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-850/50 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 dark:text-emerald-200">
                <HeartHandshake className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>What the author is looking for:</span>
              </div>

              {project.contributionNeedsNote && (
                <p className="text-xs text-emerald-800 dark:text-emerald-300 italic leading-relaxed">
                  &ldquo;{project.contributionNeedsNote}&rdquo;
                </p>
              )}

              {project.contributionAreas && project.contributionAreas.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {project.contributionAreas.map((area) => (
                    <span
                      key={area}
                      className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 shadow-2xs"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Interactive Step-by-Step Guide */}
          <div className="space-y-4">
            {/* Step 1 */}
            <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 text-xs font-bold flex items-center justify-center shrink-0">
                    1
                  </span>
                  <span className="text-xs sm:text-sm font-bold">Fork the Repository on GitHub</span>
                </div>
                {forkUrl && (
                  <a
                    href={forkUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-950 text-xs font-semibold transition-colors shrink-0"
                  >
                    <GitFork className="w-3.5 h-3.5" />
                    Fork Repo
                    <ExternalLink className="w-3 h-3 opacity-70" />
                  </a>
                )}
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 pl-8">
                Click Fork to duplicate <code className="font-mono text-neutral-800 dark:text-neutral-200">{repoFullName || project.title}</code> under your own GitHub account.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 text-xs font-bold flex items-center justify-center shrink-0">
                    2
                  </span>
                  <span className="text-xs sm:text-sm font-bold">Clone Your Fork &amp; Create a Branch</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(cloneCommands, 1)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer"
                >
                  {copiedIndex === 1 ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedIndex === 1 ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-3 rounded-xl bg-neutral-950 text-neutral-200 text-xs font-mono overflow-x-auto leading-relaxed border border-neutral-800">
                {cloneCommands}
              </pre>
            </div>

            {/* Step 3 */}
            <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 text-xs font-bold flex items-center justify-center shrink-0">
                    3
                  </span>
                  <span className="text-xs sm:text-sm font-bold">Commit &amp; Push Your Changes</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(pushCommands, 2)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer"
                >
                  {copiedIndex === 2 ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedIndex === 2 ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-3 rounded-xl bg-neutral-950 text-neutral-200 text-xs font-mono overflow-x-auto leading-relaxed border border-neutral-800">
                {pushCommands}
              </pre>
            </div>

            {/* Step 4 */}
            <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 text-xs font-bold flex items-center justify-center shrink-0">
                    4
                  </span>
                  <span className="text-xs sm:text-sm font-bold">Open Pull Request on GitHub</span>
                </div>
                {compareUrl && (
                  <a
                    href={compareUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors shrink-0"
                  >
                    <GitPullRequest className="w-3.5 h-3.5" />
                    Open PR
                    <ExternalLink className="w-3 h-3 opacity-70" />
                  </a>
                )}
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 pl-8">
                Submit your pull request comparing your feature branch to the author&apos;s main branch.
              </p>
            </div>
          </div>

          {/* Step 5: In-App Notification Trigger (Feature 3) */}
          {!isAuthor && (
            <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/50 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-900 dark:text-white">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Notify Author on GoBoard</span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Already opened your pull request on GitHub? Send a direct in-app notification to the author so they can review and merge your code faster!
              </p>

              {notificationSent ? (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Author has been notified! They will see an alert in their notification bell.</span>
                </div>
              ) : (
                <form onSubmit={handleSendNotification} className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={prUrlOrTitle}
                    onChange={(e) => setPrUrlOrTitle(e.target.value)}
                    placeholder="PR link or title (e.g. #14 feat: redesign landing page)"
                    className="flex-1 px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <button
                    type="submit"
                    disabled={sendingNotification || !prUrlOrTitle.trim()}
                    className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-950 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {sendingNotification ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>Notify Author</span>
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
