'use client';

import { addCollection } from '@iconify/react';
import { useEffect } from 'react';
import iconifyCollections from '../../icons/iconify-collections.json';

let registered = false;

const IconifyProvider = () => {
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

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(() => registerIcons(), { timeout: 2000 });
    } else {
      setTimeout(() => registerIcons(), 300);
    }
  }, []);

  return null;
};

export default IconifyProvider;
