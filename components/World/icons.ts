'use client';

import { useEffect, useState } from 'react';

import { loadIconBundle } from 'components/IconifyLoader/IconifyLoader';

import type { IconifyJSON } from '@iconify/react';

/** An Iconify icon from the offline bundle as standalone SVG markup, `size` px square, in `color` */
export function iconSvg(collections: IconifyJSON[], name: string, color: string, size = 128) {
  const [prefix, iconName] = name.split(':');
  const collection = collections.find((c) => c.prefix === prefix);
  const resolved =
    collection?.icons[iconName] ?? collection?.icons[collection.aliases?.[iconName]?.parent ?? ''];
  if (!collection || !resolved) return null;
  const width = resolved.width ?? collection.width ?? 16;
  const height = resolved.height ?? collection.height ?? 16;
  const body = resolved.body.replace(/currentColor/g, color);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${resolved.left ?? 0} ${resolved.top ?? 0} ${width} ${height}">${body}</svg>`;
}

/** The offline icon bundle, once its chunk has loaded (null until then) */
export function useIconCollections() {
  const [collections, setCollections] = useState<IconifyJSON[] | null>(null);
  useEffect(() => {
    let active = true;
    loadIconBundle().then((loaded) => {
      if (active) setCollections(loaded);
    });
    return () => {
      active = false;
    };
  }, []);
  return collections;
}
