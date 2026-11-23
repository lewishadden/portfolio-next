'use client';

import { Icon } from '@iconify/react';

import { inspectEntity } from './inspection';

import type { ReactNode } from 'react';
import type { InspectionSelection } from './inspectionTypes';

/** The same semantic entry point works with a spatial or a flat inspector. */
export function InspectButton({
  selection,
  children,
  className = 'btn btn--ghost',
  label,
}: {
  selection: InspectionSelection;
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      aria-haspopup="dialog"
      onClick={() => inspectEntity(selection)}
    >
      <Icon icon="ph:cube-focus-bold" width={17} height={17} aria-hidden="true" />
      <span>{children}</span>
    </button>
  );
}
