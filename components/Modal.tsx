import { useEffect, ReactNode } from 'react';
import { X } from 'lucide-react';

const OMS_NAVIGATION_START_EVENT = 'unieconnect:oms-navigation-start';

const sizeClasses = {
  sm: 'max-w-md',
  small: 'max-w-md',
  md: 'max-w-lg',
  medium: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  large: 'max-w-6xl',
  full: 'w-full h-full max-w-none max-h-none',
  fullMain: 'w-full h-full max-w-none max-h-none',
  side: 'w-1/2 max-w-2xl h-full max-h-full',
} as const;

type ModalSize = keyof typeof sizeClasses;

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: ModalSize;
  footer?: ReactNode;
  headerActions?: ReactNode;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  zIndexClass?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'lg',
  footer,
  headerActions,
  closeOnBackdrop = true,
  closeOnEscape = true,
  zIndexClass = 'z-50',
}: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && closeOnEscape) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, closeOnEscape]);

  useEffect(() => {
    if (!isOpen) return;
    const handleNavigationStart = () => onClose();
    window.addEventListener(OMS_NAVIGATION_START_EVENT, handleNavigationStart);
    return () => window.removeEventListener(OMS_NAVIGATION_START_EVENT, handleNavigationStart);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isSideModal = size === 'side';
  const isFullModal = size === 'full' || size === 'fullMain';

  return (
    <div
      className={`fixed ${zIndexClass} ${
        isSideModal
          ? 'inset-0 flex items-stretch justify-end bg-black bg-opacity-50'
          : isFullModal
            ? 'left-[var(--sidebar-width,240px)] right-0 top-0 bottom-0 bg-white'
            : 'inset-0 flex items-center justify-center p-4 bg-black bg-opacity-50'
      }`}
      onClick={!closeOnBackdrop ? undefined : isFullModal ? undefined : onClose}
    >
      <div
        className={`bg-white ${isFullModal ? 'shadow-none' : 'shadow-2xl'} ${
          isFullModal ? 'border-0' : 'border border-gray-200'
        } ${sizeClasses[size]} ${isSideModal ? 'rounded-l-lg' : isFullModal ? 'rounded-none' : 'rounded-lg'} ${
          isSideModal ? '' : 'w-full'
        } ${isFullModal ? 'h-full overflow-hidden' : 'max-h-[90vh]'} flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between border-b border-gray-200 ${isFullModal ? 'p-8' : 'p-6'}`}>
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <div className="flex items-center gap-2">
            {headerActions}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className={`flex-1 overflow-y-auto ${isFullModal ? 'p-8' : 'p-6'}`}>{children}</div>

        {footer && (
          <div className={`flex items-center justify-end gap-3 border-t border-gray-200 ${isFullModal ? 'p-8' : 'p-6'}`}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
