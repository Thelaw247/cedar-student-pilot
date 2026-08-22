import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { AvatarImage } from '@/components/ui/avatar';

export default function ResolvedAvatarImage({ src, ...props }) {
  const [resolved, setResolved] = useState(() => (
    String(src || '').startsWith('r2://') ? null : src
  ));

  useEffect(() => {
    let cancelled = false;
    if (!src || !String(src).startsWith('r2://')) {
      setResolved(src || null);
      return () => { cancelled = true; };
    }
    setResolved(null);
    base44.files.getDownloadUrl(src)
      .then((url) => { if (!cancelled) setResolved(url); })
      .catch((error) => console.error('Could not load profile photo', error));
    return () => { cancelled = true; };
  }, [src]);

  return resolved ? <AvatarImage src={resolved} {...props} /> : null;
}

