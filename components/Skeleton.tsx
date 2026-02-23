import React from 'react';

export const ProjectCardSkeleton: React.FC = () => (
  <div className="animate-pulse">
    {/* Thumbnail */}
    <div className="aspect-[16/10] rounded-2xl bg-neutral-200 mb-4" />
    {/* Title */}
    <div className="h-4 bg-neutral-200 rounded-lg w-3/4 mb-3" />
    {/* Description */}
    <div className="space-y-2 mb-4">
      <div className="h-3 bg-neutral-100 rounded w-full" />
      <div className="h-3 bg-neutral-100 rounded w-5/6" />
    </div>
    {/* Meta row */}
    <div className="flex items-center gap-3">
      <div className="h-3 bg-neutral-100 rounded w-20" />
      <div className="h-3 bg-neutral-100 rounded w-16" />
      <div className="h-3 bg-neutral-100 rounded w-12" />
    </div>
    {/* Tech stack */}
    <div className="flex gap-2 mt-3">
      <div className="h-6 bg-neutral-100 rounded-md w-14" />
      <div className="h-6 bg-neutral-100 rounded-md w-18" />
      <div className="h-6 bg-neutral-100 rounded-md w-12" />
    </div>
  </div>
);

export const ProjectGridSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-10">
    {Array.from({ length: count }).map((_, i) => (
      <ProjectCardSkeleton key={i} />
    ))}
  </div>
);

export const DetailSkeleton: React.FC = () => (
  <div className="animate-pulse">
    <div className="h-4 bg-neutral-200 rounded w-24 mb-6" />
    <div className="aspect-[16/9] rounded-2xl bg-neutral-200 mb-6" />
    <div className="h-6 bg-neutral-200 rounded w-2/3 mb-4" />
    <div className="space-y-2 mb-6">
      <div className="h-3 bg-neutral-100 rounded w-full" />
      <div className="h-3 bg-neutral-100 rounded w-full" />
      <div className="h-3 bg-neutral-100 rounded w-3/4" />
    </div>
    <div className="flex gap-3">
      <div className="h-8 bg-neutral-100 rounded-xl w-24" />
      <div className="h-8 bg-neutral-100 rounded-xl w-24" />
    </div>
  </div>
);
