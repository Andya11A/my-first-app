"use client";

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon, title, description, actionText, onAction }: EmptyStateProps) {
  return (
    <div className="text-center py-16">
      <p className="text-5xl mb-4">{icon}</p>
      <p className="text-lg font-medium text-gray-700 mb-1">{title}</p>
      <p className="text-sm text-gray-400 mb-6">{description}</p>
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          {actionText}
        </button>
      )}
    </div>
  );
}
