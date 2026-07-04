import React from 'react';

/**
 * EmptyState — every empty screen teaches what belongs there.
 * Polished, calm, with a clear next action.
 */
export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6 animate-fade-in">
      {Icon && (
        <div className="w-16 h-16 rounded-card bg-primary/5 flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-primary/60" strokeWidth={1.2} />
        </div>
      )}
      <h3 className="font-heading text-base font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">{description}</p>
      {action && (
        <button onClick={action.onClick}
          className="mt-5 inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2.5 rounded-button text-sm font-medium hover:bg-primary/90 transition-colors">
          {action.icon && <action.icon className="w-4 h-4" />}
          {action.label}
        </button>
      )}
    </div>
  );
}