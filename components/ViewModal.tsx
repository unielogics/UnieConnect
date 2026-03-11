import { ReactNode } from 'react';
import { Modal } from './Modal';
import { Edit, Trash2 } from 'lucide-react';

interface ViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
  isLoading?: boolean;
  headerActions?: ReactNode;
  footerContent?: ReactNode | null;
  zIndexClass?: string;
}

export function ViewModal({
  isOpen,
  onClose,
  title,
  children,
  onEdit,
  onDelete,
  deleteLabel = 'Delete',
  isLoading = false,
  headerActions,
  footerContent,
  zIndexClass,
}: ViewModalProps) {
  const footer =
    footerContent !== undefined ? (
      footerContent
    ) : (
      <div className="flex items-center justify-between w-full">
        <div>
          {onDelete && (
            <button
              onClick={onDelete}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4 inline mr-2" />
              {deleteLabel}
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
          {onEdit && (
            <button
              onClick={onEdit}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Edit className="w-4 h-4 inline mr-2" />
              Edit
            </button>
          )}
        </div>
      </div>
    );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="full"
      headerActions={headerActions}
      zIndexClass={zIndexClass}
      footer={footer}
    >
      <div className="space-y-6 overflow-y-auto h-full">{children}</div>
    </Modal>
  );
}
