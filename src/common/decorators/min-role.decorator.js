const { SetMetadata } = require('@nestjs/common');

const MIN_ROLE_KEY = 'minRole';

// Usage: @MinRole('EDITOR')  — route requires EDITOR or higher (EDITOR, OWNER).
// @MinRole('VIEWER') — anyone who's a member at all (VIEWER, EDITOR, OWNER).
// @MinRole('OWNER')  — owner only.
const MinRole = (role) => SetMetadata(MIN_ROLE_KEY, role);

module.exports = { MinRole, MIN_ROLE_KEY };