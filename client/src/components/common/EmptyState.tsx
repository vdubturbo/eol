import { Search, Database, FileQuestion, AlertCircle } from 'lucide-react';

type EmptyStateType = 'search' | 'data' | 'error' | 'not-found';

interface EmptyStateProps {
  type?: EmptyStateType;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

const defaultContent: Record<EmptyStateType, { icon: React.ReactNode; title: string; description: string }> = {
  search: {
    icon: <Search className="h-12 w-12 text-gray-600" />,
    title: 'No results found',
    description: 'Try adjusting your search or filters to find what you\'re looking for.',
  },
  data: {
    icon: <Database className="h-12 w-12 text-gray-600" />,
    title: 'No data available',
    description: 'There\'s no data to display yet. Try adding some components.',
  },
  error: {
    icon: <AlertCircle className="h-12 w-12 text-red-500" />,
    title: 'Something went wrong',
    description: 'An error occurred while loading data. Please try again.',
  },
  'not-found': {
    icon: <FileQuestion className="h-12 w-12 text-gray-600" />,
    title: 'Not found',
    description: 'The requested resource could not be found.',
  },
};

export function EmptyState({
  type = 'search',
  title,
  description,
  action,
}: EmptyStateProps) {
  const content = defaultContent[type];

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="mb-4">{content.icon}</div>
      <h3 className="text-lg font-medium text-gray-300 mb-2">
        {title || content.title}
      </h3>
      <p className="text-gray-500 max-w-md mb-6">
        {description || content.description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
}
