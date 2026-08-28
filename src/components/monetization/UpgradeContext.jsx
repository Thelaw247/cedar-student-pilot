import React, { createContext, useCallback, useContext, useState } from 'react';
import UpgradeSheet from './UpgradeSheet';

/**
 * One upgrade surface for the whole app (MON-04 §3).
 *
 * Every touchpoint — the credit meter, a locked feature, an out-of-credits
 * moment — calls openUpgrade({ source }) and gets the same sheet with an
 * entry-aware headline. One component means one place to test copy and
 * pricing presentation, and zero drift between upsell surfaces.
 */
const UpgradeContext = createContext({ openUpgrade: (_options) => {} });

export function useUpgrade() {
  return useContext(UpgradeContext);
}

export default function UpgradeProvider({ children }) {
  const [sheet, setSheet] = useState(null);

  const openUpgrade = useCallback((options = {}) => {
    setSheet({ source: 'generic', ...options });
  }, []);

  return (
    <UpgradeContext.Provider value={{ openUpgrade }}>
      {children}
      {sheet && <UpgradeSheet source={sheet.source} feature={sheet.feature} onClose={() => setSheet(null)} />}
    </UpgradeContext.Provider>
  );
}
