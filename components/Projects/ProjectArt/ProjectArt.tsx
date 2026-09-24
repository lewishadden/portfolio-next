import { Icon } from '@iconify/react';

import './ProjectArt.scss';

/**
 * Generated sci-fi cover for projects without screenshots: a glowing core
 * with the project's icon, tilted orbit rings and a scrolling grid floor.
 * Purely decorative. Fills its (positioned) parent.
 */
export function ProjectArt({
  icon,
  tone = 0,
  showIcon = true,
}: {
  icon?: string;
  /** 0–2: picks the colour pair */
  tone?: number;
  showIcon?: boolean;
}) {
  return (
    <span className={`proj-art proj-art--tone-${tone % 3}`} aria-hidden="true">
      <span className="proj-art__floor" />
      <span className="proj-art__orbit proj-art__orbit--outer" />
      <span className="proj-art__orbit proj-art__orbit--inner" />
      {showIcon && (
        <span className="proj-art__core">
          <Icon icon={icon || 'ph:code-bold'} />
        </span>
      )}
    </span>
  );
}

export default ProjectArt;
