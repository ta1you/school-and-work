import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  accent?: 'primary' | 'secondary';
}

export const Input: React.FC<InputProps> = ({
  label,
  accent = 'primary',
  className = '',
  id,
  ...props
}) => {
  const accentClasses = accent === 'primary' ? 'focus:border-[#4b88ff]' : 'focus:border-[#ef8f3b]';
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="block text-[10px] font-bold text-[#94a3b8] mb-2 uppercase tracking-wider">
          {label}
        </label>
      )}
      <input
        id={id}
        className={`w-full px-4 py-2.5 bg-[#0f1115] border border-white/5 rounded-xl text-xs text-[#f8fafc] focus:outline-none transition-all ${accentClasses} ${className}`}
        {...props}
      />
    </div>
  );
};
