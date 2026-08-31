import { emailLayout } from './shared';

const ROLE_LABELS = {
  1: 'Owner',
  2: 'Editor',
  3: 'Viewer',
};

function roleLabel(role) {
  if (typeof role === 'number') return ROLE_LABELS[role] || 'Member';
  if (typeof role === 'string' && ROLE_LABELS[role]) return ROLE_LABELS[role];
  return role || 'Member';
}

export function teamInviteEmail({
  inviterName,
  organizationName,
  role,
  inviteUrl,
}) {
  const displayRole = roleLabel(role);

  return emailLayout({
    title: 'Team Invitation',

    content: `
      <p style="color:white;">
        Hi,
      </p>

      <p style="color:white;">
        <strong>${inviterName}</strong> has invited you to join
        ${organizationName ? `<strong>${organizationName}</strong>` : 'their team'} on Repress.
      </p>

      <p style="color:white;">
        Assigned role: <strong>${displayRole}</strong>
      </p>

      <p style="color:#9999AA;">
        Once you accept, you'll be able to collaborate with the team based on
        your assigned permissions.
      </p>
    `,

    buttonText: 'Accept Invitation',

    buttonUrl: inviteUrl,
  });
}