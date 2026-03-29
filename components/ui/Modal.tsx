'use client';

import React, { useEffect } from 'react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, actions }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[300]"
        onClick={onClose}
      />
      {/* Modal */}
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
        <div
          className="bg-white rounded-lg shadow-2xl max-w-md w-full"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          {title && (
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">{title}</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>
          )}

          {/* Body */}
          <div className="p-6">{children}</div>

          {/* Actions */}
          {actions && (
            <div className="flex gap-3 p-6 border-t border-gray-200 justify-end">
              {actions}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

Modal.displayName = 'Modal';
