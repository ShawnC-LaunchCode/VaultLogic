export interface AppUser {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    profileImageUrl?: string;

    // Tenant/Workspace Context
    tenantId?: string;
    tenantRole?: 'owner' | 'builder' | 'runner' | 'viewer';

    // System Role
    role?: 'admin' | 'creator';

    // Metadata
    emailVerified: boolean;
    authProvider: 'local' | 'google';
}

// Session types removed
