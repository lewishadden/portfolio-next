import { useState } from 'react';
import { Menu, Group, Center, Burger, Flex, Anchor, Drawer, Collapse } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import ExportedImage from 'next-image-export-optimizer';
import { IconChevronDown } from '@tabler/icons-react';
import Link from 'next/link';

import { headerLinks } from 'config';

import classes from './MenuHeader.module.css';

export function MenuHeader() {
  const [expandedLink, setExpandedLink] = useState('');
  const [drawerOpened, { toggle: toggleDrawer, close: closeDrawer }] = useDisclosure(false);

  const updateExpandedLink = (link: string) => {
    if (expandedLink === link) {
      setExpandedLink('');
    } else {
      setExpandedLink(link);
    }
  };

  const items = headerLinks.map((link) => {
    const menuItems = link.links?.map((item) => (
      // Remove onClick handler when solutions pages launch
      <Menu.Item
        key={item.link}
        component={Link}
        href={item.link}
        onClick={(e) => {
          e.preventDefault();
          window.open(item.link, '_self');
        }}
      >
        {item.label}
      </Menu.Item>
    ));

    if (menuItems) {
      return (
        <Menu key={link.label} trigger="hover" transitionProps={{ exitDuration: 0 }} withinPortal>
          <Menu.Target>
            <Anchor
              renderRoot={(props) => <Link {...props} className={classes.link} />}
              href={link.link}
              onClick={(e) => e.preventDefault()}
            >
              <Center>
                <span className={classes.linkLabel}>{link.label}</span>
                <IconChevronDown size="0.9rem" stroke={1.5} />
              </Center>
            </Anchor>
          </Menu.Target>
          <Menu.Dropdown>{menuItems}</Menu.Dropdown>
        </Menu>
      );
    }

    return (
      <Anchor
        renderRoot={(props) => <Link {...props} className={classes.link} />}
        key={link.label}
        href={link.link}
      >
        {link.label}
      </Anchor>
    );
  });

  const itemsMobile = headerLinks.map((link) => {
    const menuItems = link.links?.map((item) => (
      <Anchor
        // Remove onClick handler when solutions pages launch
        renderRoot={(props) => (
          <Link
            {...props}
            className={classes.link}
            onClick={(e) => {
              e.preventDefault();
              window.open(item.link, '_self');
            }}
          />
        )}
        className={classes.link}
        key={item.label}
        href={item.link}
        onClick={() => {
          closeDrawer();
          setExpandedLink('');
        }}
      >
        {item.label}
      </Anchor>
    ));

    if (menuItems) {
      return (
        <div key={link.label}>
          <Anchor
            renderRoot={(props) => <Link {...props} className={classes.link} />}
            href={link.link}
            onClick={(e) => {
              e.preventDefault();
              updateExpandedLink(link.link);
            }}
            className={classes.link}
          >
            <span className={classes.linkLabel}>{link.label}</span>
            <IconChevronDown size="0.9rem" stroke={1.5} />
          </Anchor>
          <Collapse in={expandedLink === link.link} className={classes.menuCollapse}>
            {menuItems}
          </Collapse>
        </div>
      );
    }

    return (
      <Anchor
        renderRoot={(props) => (
          <Link
            {...props}
            className={classes.link}
            onClick={() => {
              closeDrawer();
              setExpandedLink('');
            }}
          />
        )}
        key={link.label}
        href={link.link}
      >
        {link.label}
      </Anchor>
    );
  });

  return (
    <>
      <Flex mih={60} direction="row" wrap="wrap" gap="lg" justify="flex-start" align="center">
        <Center w={130}>
          <Anchor component={Link} href="/" className={classes.imageLink}>
            <ExportedImage
              src="/static/images/logo.png"
              alt="Logo"
              width={70}
              height={70}
              title="Logo"
              className={classes.image}
              priority
            />
          </Anchor>
        </Center>
        <Group gap={5} visibleFrom="sm">
          {items}
        </Group>
        <Burger
          opened={drawerOpened}
          onClick={toggleDrawer}
          size="md"
          hiddenFrom="md"
          className={classes.burger}
          aria-label="Burger Menu"
        />
      </Flex>
      <Drawer
        opened={drawerOpened}
        onClose={closeDrawer}
        size="100%"
        padding="md"
        title="Navigation"
        hiddenFrom="md"
        zIndex={1000000}
      >
        {itemsMobile}
      </Drawer>
    </>
  );
}
