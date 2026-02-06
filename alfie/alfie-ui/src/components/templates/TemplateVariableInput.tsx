'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type { TemplateVariable } from '@/lib/store';

interface TemplateVariableInputProps {
  variable: TemplateVariable;
  value: string;
  onChange: (value: string) => void;
}

export function TemplateVariableInput({ variable, value, onChange }: TemplateVariableInputProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor={variable.name} className="text-sm font-medium">
          {variable.name.replace(/_/g, ' ')}
        </Label>
        {variable.required && (
          <Badge variant="destructive" className="text-[10px] h-4">Required</Badge>
        )}
      </div>
      <Input
        id={variable.name}
        placeholder={variable.default || variable.description}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9"
      />
      <p className="text-xs text-muted-foreground">{variable.description}</p>
    </div>
  );
}
