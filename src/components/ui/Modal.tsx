import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div 
        className="w-full max-w-sm bg-[#1a1d24] border border-white/5 rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex justify-between items-center">
            <h3 className="font-extrabold text-sm text-[#f8fafc]">{title}</h3>
            <button
              onClick={onClose}
              className="text-[#94a3b8] hover:text-[#f8fafc] text-lg font-bold p-1"
            >
              &times;
            </button>
          </div>
        )}
        <div className="space-y-4">
          {children}
        </div>
      </div>
    </div>
  );
};
