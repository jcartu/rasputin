'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Eye } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { CollaboratorInfo } from '@/lib/collaboration';

interface UserPresenceBarProps {
  collaborators: CollaboratorInfo[];
  localUser: CollaboratorInfo | null;
  maxVisible?: number;
}

export function UserPresenceBar({ 
  collaborators, 
  localUser,
  maxVisible = 5 
}: UserPresenceBarProps) {
  const otherUsers = useMemo(() => 
    collaborators.filter(c => c.id !== localUser?.id),
    [collaborators, localUser]
  );

  const visibleUsers = otherUsers.slice(0, maxVisible);
  const overflowCount = Math.max(0, otherUsers.length - maxVisible);

  if (otherUsers.length === 0 && !localUser) {
    return null;
  }

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="w-4 h-4" />
        <span>{collaborators.length} viewing</span>
      </div>

      <TooltipProvider>
        <div className="flex items-center -space-x-2">
          <AnimatePresence mode="popLayout">
            {localUser && (
              <motion.div
                key={localUser.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="relative"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative">
                      <Avatar 
                        className="w-8 h-8 border-2 ring-2 ring-background"
                        style={{ borderColor: localUser.color }}
                      >
                        <AvatarImage src={localUser.avatar} />
                        <AvatarFallback 
                          style={{ backgroundColor: localUser.color }}
                          className="text-white text-xs font-medium"
                        >
                          {getInitials(localUser.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{localUser.name} (You)</p>
                  </TooltipContent>
                </Tooltip>
              </motion.div>
            )}

            {visibleUsers.map((user) => (
              <motion.div
                key={user.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="relative"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative">
                      <Avatar 
                        className="w-8 h-8 border-2 ring-2 ring-background cursor-pointer hover:z-10 transition-transform hover:scale-110"
                        style={{ borderColor: user.color }}
                      >
                        <AvatarImage src={user.avatar} />
                        <AvatarFallback 
                          style={{ backgroundColor: user.color }}
                          className="text-white text-xs font-medium"
                        >
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span 
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 border-background rounded-full ${
                          user.status === 'online' ? 'bg-green-500' :
                          user.status === 'away' ? 'bg-yellow-500' : 'bg-gray-500'
                        }`}
                      />
                      {user.isTyping && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                        </span>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="flex items-center gap-2">
                      <span>{user.name}</span>
                      {user.isTyping && (
                        <span className="text-xs text-blue-400">typing...</span>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </motion.div>
            ))}

            {overflowCount > 0 && (
              <motion.div
                key="overflow"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="relative z-10"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="w-8 h-8 rounded-full bg-muted border-2 border-background ring-2 ring-background flex items-center justify-center text-xs font-medium text-muted-foreground cursor-pointer hover:bg-muted/80">
                      +{overflowCount}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="space-y-1">
                      {otherUsers.slice(maxVisible).map(user => (
                        <div key={user.id} className="flex items-center gap-2">
                          <div 
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: user.color }}
                          />
                          <span>{user.name}</span>
                        </div>
                      ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </TooltipProvider>
    </div>
  );
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
