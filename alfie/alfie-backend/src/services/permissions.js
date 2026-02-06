import { v4 as uuidv4 } from 'uuid';

const PermissionLevel = {
  NONE: 0,
  VIEW: 1,
  COMMENT: 2,
  EDIT: 3,
  ADMIN: 4,
};

const documentPermissions = new Map();
const shareLinks = new Map();

export function initDocumentPermissions(documentId, ownerId) {
  const permissions = {
    documentId,
    ownerId,
    public: false,
    publicPermission: PermissionLevel.NONE,
    users: new Map(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  permissions.users.set(ownerId, {
    userId: ownerId,
    level: PermissionLevel.ADMIN,
    grantedAt: new Date(),
    grantedBy: ownerId,
  });
  
  documentPermissions.set(documentId, permissions);
  return permissions;
}

export function getDocumentPermissions(documentId) {
  return documentPermissions.get(documentId) || null;
}

export function getUserPermissionLevel(documentId, userId) {
  const permissions = documentPermissions.get(documentId);
  if (!permissions) return PermissionLevel.NONE;
  
  if (permissions.ownerId === userId) return PermissionLevel.ADMIN;
  
  const userPermission = permissions.users.get(userId);
  if (userPermission) return userPermission.level;
  
  if (permissions.public) return permissions.publicPermission;
  
  return PermissionLevel.NONE;
}

export function canView(documentId, userId) {
  return getUserPermissionLevel(documentId, userId) >= PermissionLevel.VIEW;
}

export function canComment(documentId, userId) {
  return getUserPermissionLevel(documentId, userId) >= PermissionLevel.COMMENT;
}

export function canEdit(documentId, userId) {
  return getUserPermissionLevel(documentId, userId) >= PermissionLevel.EDIT;
}

export function canAdmin(documentId, userId) {
  return getUserPermissionLevel(documentId, userId) >= PermissionLevel.ADMIN;
}

export function setUserPermission(documentId, userId, level, grantedBy) {
  const permissions = documentPermissions.get(documentId);
  if (!permissions) throw new Error('Document not found');
  
  if (!canAdmin(documentId, grantedBy)) {
    throw new Error('Insufficient permissions to grant access');
  }
  
  if (level === PermissionLevel.NONE) {
    permissions.users.delete(userId);
  } else {
    permissions.users.set(userId, {
      userId,
      level,
      grantedAt: new Date(),
      grantedBy,
    });
  }
  
  permissions.updatedAt = new Date();
  return true;
}

export function removeUserPermission(documentId, userId, removedBy) {
  return setUserPermission(documentId, userId, PermissionLevel.NONE, removedBy);
}

export function setPublicAccess(documentId, isPublic, level, setBy) {
  const permissions = documentPermissions.get(documentId);
  if (!permissions) throw new Error('Document not found');
  
  if (!canAdmin(documentId, setBy)) {
    throw new Error('Insufficient permissions to change public access');
  }
  
  permissions.public = isPublic;
  permissions.publicPermission = isPublic ? level : PermissionLevel.NONE;
  permissions.updatedAt = new Date();
  
  return true;
}

export function createShareLink(documentId, options = {}, createdBy) {
  const permissions = documentPermissions.get(documentId);
  if (!permissions) throw new Error('Document not found');
  
  if (!canAdmin(documentId, createdBy)) {
    throw new Error('Insufficient permissions to create share link');
  }
  
  const linkId = uuidv4();
  const expiresAt = options.expiresIn 
    ? new Date(Date.now() + options.expiresIn) 
    : null;
  
  const shareLink = {
    id: linkId,
    documentId,
    permission: options.permission || PermissionLevel.VIEW,
    expiresAt,
    maxUses: options.maxUses || null,
    uses: 0,
    createdBy,
    createdAt: new Date(),
    active: true,
  };
  
  shareLinks.set(linkId, shareLink);
  return shareLink;
}

export function useShareLink(linkId, userId) {
  const link = shareLinks.get(linkId);
  if (!link) throw new Error('Share link not found');
  
  if (!link.active) throw new Error('Share link is no longer active');
  
  if (link.expiresAt && new Date() > link.expiresAt) {
    link.active = false;
    throw new Error('Share link has expired');
  }
  
  if (link.maxUses && link.uses >= link.maxUses) {
    link.active = false;
    throw new Error('Share link has reached maximum uses');
  }
  
  const currentLevel = getUserPermissionLevel(link.documentId, userId);
  if (currentLevel < link.permission) {
    setUserPermission(link.documentId, userId, link.permission, link.createdBy);
  }
  
  link.uses++;
  
  return {
    documentId: link.documentId,
    permission: link.permission,
  };
}

export function revokeShareLink(linkId, revokedBy) {
  const link = shareLinks.get(linkId);
  if (!link) throw new Error('Share link not found');
  
  if (!canAdmin(link.documentId, revokedBy)) {
    throw new Error('Insufficient permissions to revoke share link');
  }
  
  link.active = false;
  return true;
}

export function getDocumentShareLinks(documentId, requestedBy) {
  if (!canAdmin(documentId, requestedBy)) {
    throw new Error('Insufficient permissions to view share links');
  }
  
  const links = [];
  shareLinks.forEach(link => {
    if (link.documentId === documentId) {
      links.push(link);
    }
  });
  
  return links;
}

export function getDocumentCollaborators(documentId) {
  const permissions = documentPermissions.get(documentId);
  if (!permissions) return [];
  
  const collaborators = [];
  permissions.users.forEach((perm, userId) => {
    collaborators.push({
      userId,
      level: perm.level,
      levelName: Object.keys(PermissionLevel).find(k => PermissionLevel[k] === perm.level),
      grantedAt: perm.grantedAt,
      isOwner: userId === permissions.ownerId,
    });
  });
  
  return collaborators;
}

export function transferOwnership(documentId, newOwnerId, currentOwnerId) {
  const permissions = documentPermissions.get(documentId);
  if (!permissions) throw new Error('Document not found');
  
  if (permissions.ownerId !== currentOwnerId) {
    throw new Error('Only the owner can transfer ownership');
  }
  
  const currentOwnerPerm = permissions.users.get(currentOwnerId);
  if (currentOwnerPerm) {
    currentOwnerPerm.level = PermissionLevel.EDIT;
  }
  
  permissions.users.set(newOwnerId, {
    userId: newOwnerId,
    level: PermissionLevel.ADMIN,
    grantedAt: new Date(),
    grantedBy: currentOwnerId,
  });
  
  permissions.ownerId = newOwnerId;
  permissions.updatedAt = new Date();
  
  return true;
}

export function deleteDocumentPermissions(documentId) {
  documentPermissions.delete(documentId);
  
  shareLinks.forEach((link, linkId) => {
    if (link.documentId === documentId) {
      shareLinks.delete(linkId);
    }
  });
  
  return true;
}

export { PermissionLevel };

export default {
  PermissionLevel,
  initDocumentPermissions,
  getDocumentPermissions,
  getUserPermissionLevel,
  canView,
  canComment,
  canEdit,
  canAdmin,
  setUserPermission,
  removeUserPermission,
  setPublicAccess,
  createShareLink,
  useShareLink,
  revokeShareLink,
  getDocumentShareLinks,
  getDocumentCollaborators,
  transferOwnership,
  deleteDocumentPermissions,
};
