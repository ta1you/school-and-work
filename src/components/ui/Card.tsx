import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  hoverable = false,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`bg-[#1a1d24] border border-white/5 rounded-3xl p-6 shadow-xl transition-all ${
        hoverable ? 'hover:bg-[#262a33] hover:border-white/10' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
