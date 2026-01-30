'use client';

import { useHeadroom } from '@mantine/hooks';
import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';

import './Header.scss';

export const Header = () => {
  const isPinned = useHeadroom();

  return (
    <div className={`header__wrapper ${isPinned ? 'header__wrapper--pinned' : ''}`}>
      <Navbar
        expand="sm"
        data-bs-theme="dark"
        className="navbar"
        role="navigation"
        aria-label="Main navigation"
        collapseOnSelect
      >
        <Container>
          <Navbar.Toggle aria-controls="responsive-navbar-nav" aria-label="Toggle navigation menu" />
          <Navbar.Collapse id="responsive-navbar-nav">
            <Nav className="header" variant="pills" as="nav">
              <Nav.Item>
                <Nav.Link active={false} href="#about" className="header__link font-trebuchet">
                  About Me
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link active={false} href="#experience" className="header__link font-trebuchet">
                  Experience
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link active={false} href="#projects" className="header__link font-trebuchet">
                  My Projects
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link active={false} href="#skills" className="header__link font-trebuchet">
                  Skills
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link active={false} href="#contact" className="header__link font-trebuchet">
                  Contact Me
                </Nav.Link>
              </Nav.Item>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
    </div>
  );
};

export default Header;
