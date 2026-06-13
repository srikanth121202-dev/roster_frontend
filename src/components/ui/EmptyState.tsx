import { AlertCircle } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export default function EmptyState({ title = 'No data found', description = 'There is nothing to display here.', icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 bg-secondary-100 dark:bg-secondary-800 rounded-full flex items-center justify-center mb-4">
        {icon || <AlertCircle className="w-7 h-7 text-secondary-400" />}
      </div>
      <h3 className="text-base font-semibold text-secondary-700 dark:text-secondary-300 mb-1">{title}</h3>
      <p className="text-sm text-secondary-400 max-w-xs">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
