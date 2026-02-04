'use client';

import { useHeadroom } from '@mantine/hooks';
import {
  Container,
  Nav,
  Navbar,
  NavbarToggle,
  NavbarCollapse,
  NavLink,
  NavItem,
} from 'react-bootstrap';

import './Header.scss';

export const Header = () => {
  const isPinned = useHeadroom();

  return (
    <header className={`header__wrapper ${isPinned ? 'header__wrapper--pinned' : ''}`}>
      <Navbar
        expand="sm"
        data-bs-theme="dark"
        className="navbar"
        role="navigation"
        aria-label="Main navigation"
        collapseOnSelect
      >
        <Container>
          <NavbarToggle aria-controls="responsive-navbar-nav" aria-label="Toggle navigation menu" />
          <NavbarCollapse id="responsive-navbar-nav">
            <Nav className="header" variant="pills" as="nav">
              <NavItem>
                <NavLink active={false} href="#about" className="header__link font-trebuchet">
                  About Me
                </NavLink>
              </NavItem>
              <NavItem>
                <NavLink active={false} href="#experience" className="header__link font-trebuchet">
                  Experience
                </NavLink>
              </NavItem>
              <NavItem>
                <NavLink active={false} href="#projects" className="header__link font-trebuchet">
                  My Projects
                </NavLink>
              </NavItem>
              <NavItem>
                <NavLink active={false} href="#skills" className="header__link font-trebuchet">
                  Skills
                </NavLink>
              </NavItem>
              <NavItem>
                <NavLink active={false} href="#contact" className="header__link font-trebuchet">
                  Contact Me
                </NavLink>
              </NavItem>
            </Nav>
          </NavbarCollapse>
        </Container>
      </Navbar>
    </header>
  );
};

export default Header;
