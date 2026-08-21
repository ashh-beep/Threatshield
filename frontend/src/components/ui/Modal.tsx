import { createContext, useContext, useState, useCallback, type ReactNode, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { classNames } from '@utils/helpers';

interface ModalContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const ModalContext = createContext<ModalContextType | null>(null);

interface ModalTriggerProps {
  open: () => void;
  close: () => void;
  toggle: () => void;
  isOpen: boolean;
}

interface ModalProviderProps {
  children: ReactNode;
  trigger?: ReactNode | ((props: ModalTriggerProps) => ReactNode);
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
}

export function ModalProvider({ children, trigger, closeOnOverlayClick = true, closeOnEscape = true }: ModalProviderProps) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  const handleKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (closeOnEscape && e.key === 'Escape' && isOpen) {
      close();
    }
  }, [closeOnEscape, isOpen, close]);

  return (
    <ModalContext.Provider value={{ isOpen, open, close, toggle }}>
      {typeof trigger === 'function' ? trigger({ open, close, toggle, isOpen }) : trigger}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          onKeyDown={handleKeyDown}
        >
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/50 transition-opacity"
              aria-hidden="true"
              onClick={closeOnOverlayClick ? close : undefined}
            />
            <div className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-xl">
              {children}
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}

export function ModalClose({ children, className }: { children: ReactNode; className?: string }) {
  const { close } = useModal();
  return (
    <button
      type="button"
      className={classNames('absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors', className)}
      onClick={close}
      aria-label="Close modal"
    >
      {children}
    </button>
  );
}