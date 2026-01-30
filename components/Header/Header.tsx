'use client';

import { useCallback, useState } from 'react';
import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import Headroom from 'react-headroom';

import './Header.scss';

export const Header = () => {
  const [expanded, setExpanded] = useState(false);

  const handleNavLinkClick = useCallback(() => {
    setExpanded(false);
  }, []);

  return (
    <Headroom style={{ zIndex: 1000 }}>
      <Navbar
        expand="sm"
        data-bs-theme="dark"
        className="navbar"
        role="navigation"
        aria-label="Main navigation"
        expanded={expanded}
        onToggle={(nextExpanded) => setExpanded(nextExpanded)}
      >
        <Container>
          <Navbar.Toggle aria-controls="responsive-navbar-nav" aria-label="Toggle navigation menu" />
          <Navbar.Collapse id="responsive-navbar-nav">
            <Nav className="header" variant="pills" as="nav">
              <Nav.Item>
                <Nav.Link
                  active={false}
                  href="#about"
                  className="header__link font-trebuchet"
                  onClick={handleNavLinkClick}
                >
                  About Me
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link
                  active={false}
                  href="#experience"
                  className="header__link font-trebuchet"
                  onClick={handleNavLinkClick}
                >
                  Experience
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link
                  active={false}
                  href="#projects"
                  className="header__link font-trebuchet"
                  onClick={handleNavLinkClick}
                >
                  My Projects
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link
                  active={false}
                  href="#skills"
                  className="header__link font-trebuchet"
                  onClick={handleNavLinkClick}
                >
                  Skills
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link
                  active={false}
                  href="#contact"
                  className="header__link font-trebuchet"
                  onClick={handleNavLinkClick}
                >
                  Contact Me
                </Nav.Link>
              </Nav.Item>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
    </Headroom>
  );
};

export default Header;
