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
      className={`transition-opacity duration-200 ease-out ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ willChange: 'opacity' }}
    >
      {children}
    </div>
  );
};
