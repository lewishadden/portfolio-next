'use client';

import { addCollection } from '@iconify/react';
import { useEffect } from 'react';
import iconifyCollections from '../../icons/iconify-collections.json';

let registered = false;

export const IconifyProvider = () => {
  useEffect(() => {
    if (registered) {
      return;
    }

    const registerIcons = () => {
      if (registered) {
        return;
      }

      registered = true;
      Object.values(iconifyCollections.collections).forEach((collection) => {
        addCollection(collection);
      });
    };

    registerIcons();
  }, []);

  return null;
};
