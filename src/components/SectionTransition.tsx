import React, { useEffect, useState } from 'react';

interface SectionTransitionProps {
  children: React.ReactNode;
  sectionKey: string;
}

export const SectionTransition: React.FC<SectionTransitionProps> = ({
  children,
  sectionKey,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentKey, setCurrentKey] = useState(sectionKey);

  useEffect(() => {
    if (sectionKey !== currentKey) {
      // Fade out
      setIsVisible(false);
      
      // Wait for fade out, then change content and fade in
      const timer = setTimeout(() => {
        setCurrentKey(sectionKey);
        setIsVisible(true);
      }, 200);

      return () => clearTimeout(timer);
    } else {
      // Initial mount
      setIsVisible(true);
    }
  }, [sectionKey, currentKey]);

  return (
    <div
      className={`w-full transition-all duration-400 ${
        isVisible
          ? 'opacity-100 translate-y-0 scale-100 blur-0'
          : 'opacity-0 translate-y-3 scale-[0.99] blur-[4px]'
      }`}
      style={{
        transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      {children}
    </div>
  );
};
