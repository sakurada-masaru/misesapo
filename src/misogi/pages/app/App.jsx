import React from 'react';
import Router from './router';
import HamburgerMenu from '../shared/ui/HamburgerMenu/HamburgerMenu';

export default function App() {
  return (
    <>
      <HamburgerMenu />
      <div className="app-fullscreen">
        <Router />
      </div>
    </>
  );
}
