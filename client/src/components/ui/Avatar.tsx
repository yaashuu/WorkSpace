import React from 'react';
import { cn } from '../../lib/utils';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name?: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'busy';
}

const getInitials = (n: string) => {
  const parts = n.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return 'WS';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const getAvatarTheme = (nameStr: string) => {
  const themes = [
    'bg-indigo-100 text-indigo-700 border-indigo-200/80',
    'bg-purple-100 text-purple-700 border-purple-200/80',
    'bg-emerald-100 text-emerald-700 border-emerald-200/80',
    'bg-blue-100 text-blue-700 border-blue-200/80',
    'bg-amber-100 text-amber-700 border-amber-200/80',
    'bg-rose-100 text-rose-700 border-rose-200/80',
    'bg-teal-100 text-teal-700 border-teal-200/80',
  ];
  let hash = 0;
  for (let i = 0; i < nameStr.length; i++) {
    hash = nameStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  return themes[Math.abs(hash) % themes.length];
};

export const Avatar: React.FC<AvatarProps> = ({
  name = 'WorkSpace User',
  src,
  size = 'md',
  status,
  className,
  ...props
}) => {
  const [imageFailed, setImageFailed] = React.useState(false);

  const sizeMap = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-7 h-7 text-xs',
    md: 'w-8.5 h-8.5 text-xs',
    lg: 'w-10 h-10 text-sm font-semibold',
    xl: 'w-12 h-12 text-base font-bold',
  };

  const statusSizeMap = {
    xs: 'w-1.5 h-1.5 border',
    sm: 'w-2 h-2 border',
    md: 'w-2.5 h-2.5 border-2',
    lg: 'w-3 h-3 border-2',
    xl: 'w-3.5 h-3.5 border-2',
  };

  const statusColors = {
    online: 'bg-emerald-500',
    offline: 'bg-slate-400',
    busy: 'bg-amber-500',
  };

  const showImage = Boolean(src && !imageFailed);

  return (
    <div className={cn('relative inline-flex shrink-0 select-none', className)} {...props}>
      <div
        className={cn(
          'rounded-full flex items-center justify-center font-bold border shadow-xs tracking-wider overflow-hidden',
          getAvatarTheme(name),
          sizeMap[size]
        )}
      >
        {showImage ? (
          <img
            src={src}
            alt={name}
            onError={() => setImageFailed(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span>{getInitials(name)}</span>
        )}
      </div>

      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-white',
            statusSizeMap[size],
            statusColors[status]
          )}
        />
      )}
    </div>
  );
};
