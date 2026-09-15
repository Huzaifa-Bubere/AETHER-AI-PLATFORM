import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
}

export function Card({ children, className = '', hover = false, glow = false }: CardProps) {
  // Convert boolean props to className strings (not DOM attributes)
  const hoverClass = hover ? 'hover-lift' : '';
  const glowClass = glow ? 'shadow-sm' : '';
  
  // Don't pass hover/glow as DOM attributes - only use them for className
  return (
    <div 
      className={`bg-card border border-border rounded-xl p-6 card-shadow ${hoverClass} ${glowClass} ${className}`}
      data-hover={hover ? 'true' : undefined}
      data-glow={glow ? 'true' : undefined}
    >
      {children}
    </div>
  );
}
