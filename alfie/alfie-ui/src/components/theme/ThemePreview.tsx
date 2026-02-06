'use client';

import { Theme, ThemeColors } from '@/lib/themes';
import { cn } from '@/lib/utils';

interface ThemePreviewProps {
  theme: Theme;
  isActive?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

function ColorSwatch({ color, className }: { color: string; className?: string }) {
  return (
    <div
      className={cn('rounded-sm', className)}
      style={{ backgroundColor: `hsl(${color})` }}
    />
  );
}

export function ThemePreview({ theme, isActive, onClick, size = 'md' }: ThemePreviewProps) {
  const { colors } = theme;
  
  const sizeClasses = {
    sm: 'w-24 h-16',
    md: 'w-32 h-20',
    lg: 'w-40 h-24',
  };
  
  const swatchSizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative rounded-lg overflow-hidden border-2 transition-all duration-200',
        sizeClasses[size],
        isActive 
          ? 'border-primary ring-2 ring-primary/50 scale-105' 
          : 'border-border hover:border-primary/50 hover:scale-102'
      )}
      style={{ backgroundColor: `hsl(${colors.background})` }}
      aria-label={`Select ${theme.name} theme`}
    >
      <div className="absolute inset-0 p-2 flex flex-col justify-between">
        <div className="flex items-center gap-1">
          <div 
            className="h-2 flex-1 rounded-sm"
            style={{ backgroundColor: `hsl(${colors.card})` }}
          />
        </div>
        
        <div className="flex items-center gap-1">
          <ColorSwatch color={colors.primary} className={swatchSizeClasses[size]} />
          <ColorSwatch color={colors.accent} className={swatchSizeClasses[size]} />
          <ColorSwatch color={colors.secondary} className={swatchSizeClasses[size]} />
        </div>
        
        <div className="flex items-center gap-1">
          <div 
            className="h-1.5 w-8 rounded-sm"
            style={{ backgroundColor: `hsl(${colors.foreground})` }}
          />
          <div 
            className="h-1.5 w-4 rounded-sm opacity-50"
            style={{ backgroundColor: `hsl(${colors.mutedForeground})` }}
          />
        </div>
      </div>
      
      {isActive && (
        <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-primary flex items-center justify-center">
          <svg className="w-2 h-2 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </button>
  );
}

interface ThemePreviewCardProps {
  theme: Theme;
  isActive?: boolean;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  showActions?: boolean;
}

export function ThemePreviewCard({ 
  theme, 
  isActive, 
  onClick, 
  onEdit, 
  onDelete,
  showActions 
}: ThemePreviewCardProps) {
  const { colors } = theme;

  return (
    <button
      type="button"
      className={cn(
        'group relative rounded-xl overflow-hidden border-2 transition-all duration-200 cursor-pointer text-left w-full',
        isActive 
          ? 'border-primary ring-2 ring-primary/30' 
          : 'border-border hover:border-primary/50'
      )}
      onClick={onClick}
      aria-label={`Select ${theme.name} theme`}
      aria-pressed={isActive}
    >
      <div 
        className="p-4 min-h-[120px]"
        style={{ backgroundColor: `hsl(${colors.background})` }}
      >
        <div className="space-y-2">
          <div 
            className="h-3 w-3/4 rounded"
            style={{ backgroundColor: `hsl(${colors.foreground})` }}
          />
          <div 
            className="h-2 w-1/2 rounded opacity-60"
            style={{ backgroundColor: `hsl(${colors.mutedForeground})` }}
          />
        </div>
        
        <div className="mt-4 flex gap-2">
          <div 
            className="h-6 w-16 rounded-md"
            style={{ backgroundColor: `hsl(${colors.primary})` }}
          />
          <div 
            className="h-6 w-12 rounded-md"
            style={{ backgroundColor: `hsl(${colors.secondary})` }}
          />
        </div>
        
        <div className="mt-3 flex gap-1.5">
          <ColorSwatch color={colors.success} className="w-4 h-4" />
          <ColorSwatch color={colors.warning} className="w-4 h-4" />
          <ColorSwatch color={colors.info} className="w-4 h-4" />
          <ColorSwatch color={colors.destructive} className="w-4 h-4" />
        </div>
      </div>
      
      <div 
        className="px-4 py-3 border-t"
        style={{ 
          backgroundColor: `hsl(${colors.card})`,
          borderColor: `hsl(${colors.border})`
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 
              className="font-medium text-sm"
              style={{ color: `hsl(${colors.cardForeground})` }}
            >
              {theme.name}
            </h3>
            <p 
              className="text-xs opacity-70 truncate max-w-[150px]"
              style={{ color: `hsl(${colors.mutedForeground})` }}
            >
              {theme.description}
            </p>
          </div>
          
          {showActions && !theme.isBuiltIn && (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {onEdit && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onEdit(); }}
                  className="p-1.5 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
                  style={{ color: `hsl(${colors.mutedForeground})` }}
                  aria-label={`Edit ${theme.name} theme`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  className="p-1.5 rounded-md hover:bg-red-500/20 transition-colors cursor-pointer"
                  style={{ color: `hsl(${colors.destructive})` }}
                  aria-label={`Delete ${theme.name} theme`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      
      {isActive && (
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-medium bg-primary text-primary-foreground">
          Active
        </div>
      )}
    </button>
  );
}
