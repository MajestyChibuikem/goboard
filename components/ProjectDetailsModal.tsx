import React, { useState, useEffect } from 'react';
import { Project, GeminiInsight } from '../types';
import { X, ExternalLink, Github, Bot, Sparkles, User, Calendar, Tag, ThumbsUp } from 'lucide-react';
import { Button } from './Button';
import { generateProjectInsight } from '../services/geminiService';

interface ProjectDetailsModalProps {
  project: Project | null;
  onClose: () => void;
}

export const ProjectDetailsModal: React.FC<ProjectDetailsModalProps> = ({ project, onClose }) => {
  const [insight, setInsight] = useState<GeminiInsight | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);

  // Reset insight when project changes
  useEffect(() => {
    setInsight(null);
  }, [project]);

  if (!project) return null;

  const handleGenerateInsight = async () => {
    setLoadingInsight(true);
    const data = await generateProjectInsight(project);
    setInsight(data);
    setLoadingInsight(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col md:flex-row overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Close Button Mobile */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-white/80 rounded-full md:hidden text-gray-500 hover:text-gray-900"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Image Section */}
        <div className="w-full md:w-2/5 h-64 md:h-auto relative bg-gray-100">
          <img 
            src={project.imageUrl} 
            alt={project.title} 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-6 md:hidden">
            <h2 className="text-white text-2xl font-bold">{project.title}</h2>
            <p className="text-white/90 text-sm">{project.category}</p>
          </div>
        </div>

        {/* Content Section */}
        <div className="w-full md:w-3/5 p-6 md:p-8 lg:p-10 flex flex-col bg-white">
          <div className="flex justify-between items-start mb-6">
            <div className="hidden md:block">
              <h2 className="text-3xl font-bold text-gray-900 mb-1">{project.title}</h2>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <span className="px-2 py-0.5 bg-gouni-primary/10 text-gouni-primary rounded font-medium">{project.category}</span>
                <span>•</span>
                <span>{project.datePosted}</span>
              </div>
            </div>
            <button onClick={onClose} className="hidden md:block p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-6">
            {/* Author Info */}
            <div className="flex items-center p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="w-10 h-10 rounded-full bg-gouni-secondary flex items-center justify-center text-gouni-dark font-bold text-lg mr-4">
                {project.studentName.charAt(0)}
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900">{project.studentName}</div>
                <div className="text-xs text-gray-500">{project.level} Student • Faculty of Computing</div>
              </div>
            </div>

            {/* Description */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">About the Project</h3>
              <p className="text-gray-600 leading-relaxed">
                {project.description}
              </p>
            </div>

            {/* Tech Stack */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">Tech Stack</h3>
              <div className="flex flex-wrap gap-2">
                {project.techStack.map(tech => (
                  <span key={tech} className="px-3 py-1 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 font-medium shadow-sm">
                    {tech}
                  </span>
                ))}
              </div>
            </div>

            {/* AI Insight Section */}
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-5 border border-indigo-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center text-gouni-primary">
                  <Sparkles className="w-5 h-5 mr-2" />
                  <h3 className="font-bold">Faculty AI Analyst</h3>
                </div>
                {!insight && (
                  <Button 
                    size="sm" 
                    onClick={handleGenerateInsight} 
                    isLoading={loadingInsight}
                    variant="primary"
                    className="text-xs px-3 py-1"
                  >
                    Generate Review
                  </Button>
                )}
              </div>
              
              {insight ? (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div>
                    <span className="text-xs font-bold text-indigo-500 uppercase">Review</span>
                    <p className="text-sm text-gray-700 mt-1">{insight.review}</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-indigo-500 uppercase">Potential Impact</span>
                    <p className="text-sm text-gray-700 mt-1">{insight.impact}</p>
                  </div>
                  <div className="bg-white/50 p-3 rounded-lg border border-indigo-100">
                    <span className="text-xs font-bold text-amber-600 uppercase flex items-center">
                      <Bot className="w-3 h-3 mr-1" /> Suggestion
                    </span>
                    <p className="text-sm text-gray-700 mt-1 italic">"{insight.suggestion}"</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">
                  Get an AI-powered evaluation of this project's technical merit and potential impact.
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-4 mt-auto">
              <Button variant="primary" icon={<ThumbsUp className="w-4 h-4"/>} className="flex-1">
                Vote ({project.likes})
              </Button>
              {project.demoUrl && (
                <a href={project.demoUrl} target="_blank" rel="noreferrer" className="flex-1">
                  <Button variant="outline" icon={<ExternalLink className="w-4 h-4"/>} className="w-full">
                    Live Demo
                  </Button>
                </a>
              )}
              {project.repoUrl && (
                <a href={project.repoUrl} target="_blank" rel="noreferrer">
                  <Button variant="ghost" className="px-3">
                    <Github className="w-5 h-5" />
                  </Button>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
