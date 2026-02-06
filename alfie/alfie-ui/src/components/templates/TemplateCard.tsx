'use client';

import { motion } from 'framer-motion';
import { 
  Code, Search, PenTool, Lightbulb, Bug, Layout, 
  GraduationCap, Server, FileText, Star, Users, Clock
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { SessionTemplate } from '@/lib/store';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<string, React.ElementType> = {
  'code': Code,
  'search': Search,
  'pen-tool': PenTool,
  'lightbulb': Lightbulb,
  'bug': Bug,
  'layout': Layout,
  'graduation-cap': GraduationCap,
  'server': Server,
  'file-text': FileText,
};

interface TemplateCardProps {
  template: SessionTemplate;
  onClick: () => void;
  variant?: 'default' | 'compact';
  isSelected?: boolean;
}

export function TemplateCard({ template, onClick, variant = 'default', isSelected }: TemplateCardProps) {
  const IconComponent = ICON_MAP[template.icon] || FileText;
  
  if (variant === 'compact') {
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Card 
          className={cn(
            "cursor-pointer transition-all hover:border-primary/50 hover:bg-accent/50",
            isSelected && "border-primary bg-primary/5"
          )}
          onClick={onClick}
        >
          <CardContent className="p-3 flex items-center gap-3">
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
              template.category === 'development' && "bg-blue-500/10 text-blue-500",
              template.category === 'research' && "bg-purple-500/10 text-purple-500",
              template.category === 'writing' && "bg-green-500/10 text-green-500",
              template.category === 'creativity' && "bg-yellow-500/10 text-yellow-500",
              template.category === 'learning' && "bg-orange-500/10 text-orange-500",
              !['development', 'research', 'writing', 'creativity', 'learning'].includes(template.category) && "bg-muted text-muted-foreground"
            )}>
              <IconComponent className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{template.name}</p>
              <p className="text-xs text-muted-foreground truncate">{template.description}</p>
            </div>
            {template.isBuiltIn && (
              <Badge variant="secondary" className="text-[10px] shrink-0">Built-in</Badge>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  }
  
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
    >
      <Card 
        className={cn(
          "cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5",
          isSelected && "border-primary bg-primary/5"
        )}
        onClick={onClick}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3 mb-3">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
              template.category === 'development' && "bg-blue-500/10 text-blue-500",
              template.category === 'research' && "bg-purple-500/10 text-purple-500",
              template.category === 'writing' && "bg-green-500/10 text-green-500",
              template.category === 'creativity' && "bg-yellow-500/10 text-yellow-500",
              template.category === 'learning' && "bg-orange-500/10 text-orange-500",
              !['development', 'research', 'writing', 'creativity', 'learning'].includes(template.category) && "bg-muted text-muted-foreground"
            )}>
              <IconComponent className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm truncate">{template.name}</h3>
                {template.isBuiltIn && (
                  <Badge variant="secondary" className="text-[10px]">Built-in</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{template.author}</p>
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {template.description}
          </p>
          
          <div className="flex flex-wrap gap-1 mb-3">
            {template.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px]">
                {tag}
              </Badge>
            ))}
            {template.tags.length > 3 && (
              <Badge variant="outline" className="text-[10px]">
                +{template.tags.length - 3}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Star className="w-3 h-3 text-yellow-500" />
                {template.rating.toFixed(1)}
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {template.usageCount}
              </span>
            </div>
            {template.variables.length > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {template.variables.length} vars
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
