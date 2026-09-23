const ROLES = {
    ADMIN: 'Admin',
    INVESTIGATOR: 'Investigator',
    NODAL_OFFICER: 'State Nodal Officer'
};

// Very basic mock RBAC middleware for MVP
const requireAuth = (allowedRoles = []) => {
    return (req, res, next) => {
        // In a real app, verify JWT here
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
        }

        const token = authHeader.split(' ')[1];
        
        // Mock token parsing (e.g. mock-token-investigator)
        let userRole = null;
        if (token.includes('admin')) userRole = ROLES.ADMIN;
        else if (token.includes('investigator')) userRole = ROLES.INVESTIGATOR;
        else if (token.includes('nodal')) userRole = ROLES.NODAL_OFFICER;
        else {
            return res.status(403).json({ error: 'Forbidden: Invalid role token' });
        }

        if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
            return res.status(403).json({ error: `Forbidden: Requires one of [${allowedRoles.join(', ')}]` });
        }

        req.user = { role: userRole, id: 'user-123' };
        next();
    };
};

module.exports = {
    ROLES,
    requireAuth
};
