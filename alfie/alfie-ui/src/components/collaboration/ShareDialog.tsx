'use client';

import { useState } from 'react';
import { 
  Link, 
  Copy, 
  Check, 
  Globe, 
  Users,
  Mail,
  Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select } from '@/components/ui/select';
import { 
  useCollaborationStore, 
  PermissionLevel,
  type ShareLink 
} from '@/lib/collaboration';

interface ShareDialogProps {
  children?: React.ReactNode;
  documentTitle?: string;
}

const permissionLabels: Record<number, string> = {
  [PermissionLevel.VIEW]: 'Can view',
  [PermissionLevel.COMMENT]: 'Can comment',
  [PermissionLevel.EDIT]: 'Can edit',
  [PermissionLevel.ADMIN]: 'Admin',
};

const permissionOptions = [
  { value: PermissionLevel.VIEW.toString(), label: 'Can view' },
  { value: PermissionLevel.COMMENT.toString(), label: 'Can comment' },
  { value: PermissionLevel.EDIT.toString(), label: 'Can edit' },
];

export function ShareDialog({ children, documentTitle }: ShareDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [selectedPermission, setSelectedPermission] = useState(PermissionLevel.VIEW.toString());
  const [isPublic, setIsPublic] = useState(false);
  const [publicPermission, setPublicPermission] = useState(PermissionLevel.VIEW.toString());
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState<string | null>(null);
  const [isCreatingLink, setIsCreatingLink] = useState(false);

  const {
    documentId,
    metadata,
    permission,
    shareLinks,
    localUser,
    collaborators,
    createShareLink,
    revokeShareLink,
    setPermission,
    setPublicAccess,
  } = useCollaborationStore();

  const canShare = permission >= PermissionLevel.ADMIN;
  const shareUrl = documentId 
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/doc/${documentId}`
    : '';

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyShareLink = async (link: ShareLink) => {
    const url = `${shareUrl}?invite=${link.id}`;
    await navigator.clipboard.writeText(url);
    setLinkCopied(link.id);
    setTimeout(() => setLinkCopied(null), 2000);
  };

  const handleInvite = async () => {
    if (!email.trim()) return;
    
    try {
      await setPermission(email.trim(), parseInt(selectedPermission));
      setEmail('');
    } catch (error) {
      console.error('Failed to invite:', error);
    }
  };

  const handleCreateLink = async () => {
    setIsCreatingLink(true);
    try {
      await createShareLink(parseInt(selectedPermission));
    } catch (error) {
      console.error('Failed to create link:', error);
    } finally {
      setIsCreatingLink(false);
    }
  };

  const handleRevokeLink = async (linkId: string) => {
    try {
      await revokeShareLink(linkId);
    } catch (error) {
      console.error('Failed to revoke link:', error);
    }
  };

  const handlePublicToggle = async (checked: boolean) => {
    setIsPublic(checked);
    try {
      await setPublicAccess(checked, parseInt(publicPermission));
    } catch (error) {
      console.error('Failed to set public access:', error);
      setIsPublic(!checked);
    }
  };

  const handlePublicPermissionChange = async (value: string) => {
    setPublicPermission(value);
    if (isPublic) {
      try {
        await setPublicAccess(true, parseInt(value));
      } catch (error) {
        console.error('Failed to update public permission:', error);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <Users className="w-4 h-4 mr-2" />
            Share
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Share &quot;{documentTitle || metadata?.title || 'Document'}&quot;
          </DialogTitle>
          <DialogDescription>
            Invite people to collaborate or share a link
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {canShare && (
            <>
              <div className="space-y-3">
                <Label>Invite by email</Label>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="Enter email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1"
                    onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                  />
                  <Select
                    value={selectedPermission}
                    onValueChange={setSelectedPermission}
                    options={permissionOptions}
                    className="w-[140px]"
                  />
                  <Button onClick={handleInvite} disabled={!email.trim()}>
                    <Mail className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <Separator />
            </>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Link className="w-4 h-4" />
                Copy link
              </Label>
            </div>
            <div className="flex gap-2">
              <Input
                value={shareUrl}
                readOnly
                className="flex-1 bg-muted"
              />
              <Button variant="outline" onClick={handleCopyLink}>
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {canShare && (
            <>
              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    <div>
                      <Label>Public access</Label>
                      <p className="text-xs text-muted-foreground">
                        Anyone with the link can access
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={isPublic}
                    onCheckedChange={handlePublicToggle}
                  />
                </div>

                <AnimatePresence>
                  {isPublic && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <Select
                        value={publicPermission}
                        onValueChange={handlePublicPermissionChange}
                        options={permissionOptions}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Share links</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCreateLink}
                    disabled={isCreatingLink}
                  >
                    {isCreatingLink ? 'Creating...' : 'Create link'}
                  </Button>
                </div>

                {shareLinks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No share links created
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[150px] overflow-y-auto">
                    {shareLinks.filter(l => l.active).map(link => (
                      <div
                        key={link.id}
                        className="flex items-center justify-between p-2 rounded-lg border border-border bg-muted/30"
                      >
                        <div className="flex items-center gap-2">
                          <Link className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <Badge variant="secondary" className="text-xs">
                              {permissionLabels[link.permission]}
                            </Badge>
                            {link.maxUses && (
                              <span className="text-xs text-muted-foreground ml-2">
                                {link.uses}/{link.maxUses} uses
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleCopyShareLink(link)}
                          >
                            {linkCopied === link.id ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleRevokeLink(link.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <Separator />

          <div className="space-y-3">
            <Label>People with access</Label>
            <div className="space-y-2 max-h-[150px] overflow-y-auto">
              {collaborators.map(user => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={user.avatar} />
                      <AvatarFallback style={{ backgroundColor: user.color }}>
                        {user.name[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">
                        {user.name}
                        {user.id === localUser?.id && (
                          <span className="text-muted-foreground ml-1">(you)</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {user.status === 'online' ? 'Active now' : 'Away'}
                      </p>
                    </div>
                  </div>
                  {user.id === metadata?.ownerId ? (
                    <Badge>Owner</Badge>
                  ) : (
                    <Badge variant="secondary">
                      {user.status === 'online' ? 'Online' : 'Away'}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ShareDialog;
