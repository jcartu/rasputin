/**
 * Role-Based Access Control (RBAC) Service
 * Defines roles, permissions, and access control logic
 */

/**
 * Permission format: resource:action
 * Examples: users:read, sessions:create, admin:manage
 */

// Define all available permissions
export const PERMISSIONS = {
  // User management
  USERS_READ: 'users:read',
  USERS_CREATE: 'users:create',
  USERS_UPDATE: 'users:update',
  USERS_DELETE: 'users:delete',
  USERS_MANAGE: 'users:manage', // Full user management
  
  // Session management
  SESSIONS_READ: 'sessions:read',
  SESSIONS_CREATE: 'sessions:create',
  SESSIONS_DELETE: 'sessions:delete',
  SESSIONS_MANAGE: 'sessions:manage',
  
  // Chat/messaging
  CHAT_SEND: 'chat:send',
  CHAT_READ: 'chat:read',
  
  // File operations
  FILES_READ: 'files:read',
  FILES_WRITE: 'files:write',
  FILES_DELETE: 'files:delete',
  
  // Search
  SEARCH_BASIC: 'search:basic',
  SEARCH_DEEP: 'search:deep',
  
  // Analytics
  ANALYTICS_READ: 'analytics:read',
  ANALYTICS_EXPORT: 'analytics:export',
  
  // System
  SYSTEM_READ: 'system:read',
  SYSTEM_MANAGE: 'system:manage',
  
  // API Keys
  APIKEYS_READ: 'apikeys:read',
  APIKEYS_CREATE: 'apikeys:create',
  APIKEYS_DELETE: 'apikeys:delete',
  APIKEYS_MANAGE: 'apikeys:manage',
  
  // Admin
  ADMIN_ACCESS: 'admin:access',
  ADMIN_MANAGE: 'admin:manage',
  
  // Wildcard
  ALL: '*'
};

// Define roles with their permissions
export const ROLES = {
  // Super admin - full access
  admin: {
    name: 'Administrator',
    description: 'Full system access',
    permissions: [PERMISSIONS.ALL],
    inherits: []
  },
  
  // Manager - can manage users and view everything
  manager: {
    name: 'Manager',
    description: 'User management and full read access',
    permissions: [
      PERMISSIONS.USERS_READ,
      PERMISSIONS.USERS_CREATE,
      PERMISSIONS.USERS_UPDATE,
      PERMISSIONS.APIKEYS_READ,
      PERMISSIONS.APIKEYS_CREATE,
      PERMISSIONS.ANALYTICS_READ,
      PERMISSIONS.ANALYTICS_EXPORT,
      PERMISSIONS.SYSTEM_READ,
      PERMISSIONS.ADMIN_ACCESS
    ],
    inherits: ['user']
  },
  
  // Power user - extended features
  power_user: {
    name: 'Power User',
    description: 'Extended features and deep search',
    permissions: [
      PERMISSIONS.SEARCH_DEEP,
      PERMISSIONS.FILES_WRITE,
      PERMISSIONS.ANALYTICS_READ,
      PERMISSIONS.APIKEYS_READ,
      PERMISSIONS.APIKEYS_CREATE
    ],
    inherits: ['user']
  },
  
  // Regular user - standard access
  user: {
    name: 'User',
    description: 'Standard user access',
    permissions: [
      PERMISSIONS.SESSIONS_READ,
      PERMISSIONS.SESSIONS_CREATE,
      PERMISSIONS.SESSIONS_DELETE,
      PERMISSIONS.CHAT_SEND,
      PERMISSIONS.CHAT_READ,
      PERMISSIONS.FILES_READ,
      PERMISSIONS.SEARCH_BASIC,
      PERMISSIONS.SYSTEM_READ
    ],
    inherits: ['viewer']
  },
  
  // Viewer - read-only access
  viewer: {
    name: 'Viewer',
    description: 'Read-only access',
    permissions: [
      PERMISSIONS.SESSIONS_READ,
      PERMISSIONS.CHAT_READ,
      PERMISSIONS.FILES_READ,
      PERMISSIONS.SYSTEM_READ
    ],
    inherits: []
  },
  
  // Service account - for API integrations
  service: {
    name: 'Service Account',
    description: 'API integration access',
    permissions: [
      PERMISSIONS.SESSIONS_READ,
      PERMISSIONS.SESSIONS_CREATE,
      PERMISSIONS.SESSIONS_DELETE,
      PERMISSIONS.CHAT_SEND,
      PERMISSIONS.CHAT_READ,
      PERMISSIONS.FILES_READ,
      PERMISSIONS.FILES_WRITE,
      PERMISSIONS.SEARCH_BASIC,
      PERMISSIONS.SEARCH_DEEP
    ],
    inherits: []
  }
};

// Cache for resolved role permissions
const rolePermissionsCache = new Map();

/**
 * Get all permissions for a role (including inherited)
 */
export function getRolePermissions(roleName) {
  // Check cache
  if (rolePermissionsCache.has(roleName)) {
    return rolePermissionsCache.get(roleName);
  }
  
  const role = ROLES[roleName];
  if (!role) {
    return new Set();
  }
  
  const permissions = new Set(role.permissions);
  
  // Add inherited permissions
  for (const inheritedRole of role.inherits) {
    const inheritedPermissions = getRolePermissions(inheritedRole);
    for (const perm of inheritedPermissions) {
      permissions.add(perm);
    }
  }
  
  // Cache the result
  rolePermissionsCache.set(roleName, permissions);
  
  return permissions;
}

/**
 * Get all permissions for multiple roles
 */
export function getPermissionsForRoles(roles) {
  const allPermissions = new Set();
  
  for (const role of roles) {
    const rolePerms = getRolePermissions(role);
    for (const perm of rolePerms) {
      allPermissions.add(perm);
    }
  }
  
  return allPermissions;
}

/**
 * Check if a set of permissions grants a specific permission
 */
export function hasPermission(grantedPermissions, requiredPermission) {
  // Wildcard grants everything
  if (grantedPermissions.has(PERMISSIONS.ALL)) {
    return true;
  }
  
  // Direct match
  if (grantedPermissions.has(requiredPermission)) {
    return true;
  }
  
  // Check resource wildcard (e.g., 'users:*' grants 'users:read')
  const [resource] = requiredPermission.split(':');
  if (grantedPermissions.has(`${resource}:*`)) {
    return true;
  }
  
  // Check manage permission (e.g., 'users:manage' grants 'users:read')
  if (grantedPermissions.has(`${resource}:manage`)) {
    return true;
  }
  
  return false;
}

/**
 * Check if user has required permission
 */
export function userHasPermission(user, requiredPermission) {
  // Get all permissions from roles
  const rolePermissions = getPermissionsForRoles(user.roles || []);
  
  // Add direct user permissions
  const allPermissions = new Set([...rolePermissions, ...(user.permissions || [])]);
  
  return hasPermission(allPermissions, requiredPermission);
}

/**
 * Check if user has any of the required permissions
 */
export function userHasAnyPermission(user, requiredPermissions) {
  return requiredPermissions.some(perm => userHasPermission(user, perm));
}

/**
 * Check if user has all required permissions
 */
export function userHasAllPermissions(user, requiredPermissions) {
  return requiredPermissions.every(perm => userHasPermission(user, perm));
}

/**
 * Check if user has required role
 */
export function userHasRole(user, requiredRole) {
  if (!user.roles) return false;
  
  // Admin role supersedes all
  if (user.roles.includes('admin')) return true;
  
  return user.roles.includes(requiredRole);
}

/**
 * Check if user has any of the required roles
 */
export function userHasAnyRole(user, requiredRoles) {
  return requiredRoles.some(role => userHasRole(user, role));
}

/**
 * Get list of all available roles
 */
export function getAvailableRoles() {
  return Object.entries(ROLES).map(([key, value]) => ({
    id: key,
    name: value.name,
    description: value.description,
    permissions: Array.from(getRolePermissions(key))
  }));
}

/**
 * Get list of all available permissions
 */
export function getAvailablePermissions() {
  return Object.entries(PERMISSIONS).map(([key, value]) => ({
    id: value,
    name: key.replace(/_/g, ' ').toLowerCase()
  }));
}

/**
 * Validate role name
 */
export function isValidRole(roleName) {
  return roleName in ROLES;
}

/**
 * Validate permission
 */
export function isValidPermission(permission) {
  return Object.values(PERMISSIONS).includes(permission) || 
         permission.endsWith(':*') ||
         permission === '*';
}

export default {
  PERMISSIONS,
  ROLES,
  getRolePermissions,
  getPermissionsForRoles,
  hasPermission,
  userHasPermission,
  userHasAnyPermission,
  userHasAllPermissions,
  userHasRole,
  userHasAnyRole,
  getAvailableRoles,
  getAvailablePermissions,
  isValidRole,
  isValidPermission
};
