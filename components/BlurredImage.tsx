import React, { useState, useEffect, useRef } from 'react';
import { Layers, ImageOff } from 'lucide-react';

export interface BlurredImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string | null;
  alt: string;
  fallbackText?: string;
  containerClassName?: string;
  className?: string;
  aspectRatio?: string; // e.g. "aspect-[16/10]"
}

export const BlurredImage: React.FC<BlurredImageProps> = ({
  src,
  alt,
  fallbackText,
  containerClassName = '',
  className = '',
  aspectRatio = 'aspect-[16/10]',
  loading = 'lazy',
  decoding = 'async',
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // If already cached in browser, immediately mark as loaded without flicker
  useEffect(() => {
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setIsLoaded(true);
    }
  }, [src]);

  // Reset status when src changes
  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
  }, [src]);

  const showFallback = hasError || !src;

  return (
    <div className={`relative overflow-hidden bg-neutral-100 dark:bg-neutral-800/80 ${aspectRatio} ${containerClassName}`}>
      {/* Low-res Blurred Shimmer Placeholder */}
      {!isLoaded && !showFallback && (
        <div className="absolute inset-0 z-0">
          {/* Subtle gradient shimmer */}
          <div className="absolute inset-0 bg-gradient-to-tr from-neutral-200/70 via-neutral-100/40 to-neutral-200/80 dark:from-neutral-800/90 dark:via-neutral-700/40 dark:to-neutral-800/90 animate-pulse" />
          {/* Blurred backdrop wash */}
          <div className="absolute inset-0 backdrop-blur-md bg-neutral-900/5 dark:bg-white/5" />
        </div>
      )}

      {/* Actual Image with progressive blur-up transition */}
      {!showFallback ? (
        <img
          ref={imgRef}
          src={src || undefined}
          alt={alt}
          loading={loading}
          decoding={decoding}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          className={`w-full h-full object-cover transition-all duration-500 ease-out ${
            isLoaded
              ? 'opacity-100 blur-0 scale-100'
              : 'opacity-0 blur-md scale-105'
          } ${className}`}
          {...props}
        />
      ) : (
        /* Graceful Fallback if image is missing or failed to load */
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4 text-center bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-900 text-neutral-400 dark:text-neutral-500 select-none">
          <Layers className="w-8 h-8 opacity-40" />
          <span className="text-xs font-medium line-clamp-1 opacity-70">
            {fallbackText || alt || 'Project Showcase'}
          </span>
        </div>
      )}
    </div>
  );
};
