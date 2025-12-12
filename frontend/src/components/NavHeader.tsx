/**
 * @file components/NavHeader.tsx
 * @description Navigation header with page links
 */

import { NavLink } from 'react-router-dom';

export function NavHeader() {
    return (
        <nav className="nav-header">
            <div className="nav-links">
                <NavLink
                    to="/"
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                    🎯 Auction
                </NavLink>
                <NavLink
                    to="/uni"
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                    🦄 Uni V4 Hook
                </NavLink>
            </div>
        </nav>
    );
}
