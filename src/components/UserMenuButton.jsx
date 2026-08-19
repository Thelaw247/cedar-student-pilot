import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getInitials, getAvatarColor } from '@/lib/avatar';

/**
 * Top-left profile access. Replaces the Cedar logo lockup in both the desktop
 * Sidebar and the mobile Home header — the brand mark stays everywhere else
 * (favicon, home-screen icon, marketing) but this corner is profile-only now.
 *
 * Deliberately a direct link to /settings, not a dropdown/popover: the
 * profile section already exists there in full, and a popover would add its
 * own open/close state and outside-click handling for no real gain over one
 * navigation.
 */
export default function UserMenuButton({ size = 'default' }) {
  const { user } = useAuth();
  const dims = size === 'sm' ? 'w-8 h-8' : 'w-9 h-9';

  return (
    <Link
      to="/settings"
      className="flex items-center gap-2.5 rounded-lg hover:bg-muted transition-colors -mx-1.5 px-1.5 py-1"
      title="Profile & settings"
    >
      <Avatar className={`${dims} flex-shrink-0`}>
        {user?.avatar_url && <AvatarImage src={user.avatar_url} alt={user?.full_name || 'Profile photo'} />}
        <AvatarFallback
          style={{ backgroundColor: getAvatarColor(user?.id), color: '#fff' }}
          className="text-xs font-semibold"
        >
          {getInitials(user?.full_name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 text-left">
        <p className="font-heading font-bold text-sm leading-none text-foreground truncate">
          {user?.full_name || 'Your account'}
        </p>
        <p className="text-[10px] text-muted-foreground mt-1 truncate">{user?.email}</p>
      </div>
    </Link>
  );
}
