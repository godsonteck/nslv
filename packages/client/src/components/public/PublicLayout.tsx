import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BedDouble, CalendarDays, LogOut, Mail, MapPin, Menu, Phone, UserRound, X } from 'lucide-react';
import { guestAuthApi, guestSession, publicApi, type PublicBookingConfig } from '../../services/publicApi';

const FALLBACK = {
  name: 'NS Luxury Villa',
  address: 'Ho, Volta Region, Ghana',
  phone: '+233 535 572 774',
  email: 'nsvilla4u@gmail.com',
};

export const PublicLayout: React.FC = () => {
  const [config, setConfig] = useState<PublicBookingConfig | null>(null);
  const [signedIn, setSignedIn] = useState(guestSession.hasSession());
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    publicApi.getConfig().then(setConfig).catch(() => setConfig(null));
  }, []);

  useEffect(() => {
    setSignedIn(guestSession.hasSession());
    setMenuOpen(false);
  }, [location.pathname]);

  const villa = config?.villa || FALLBACK;

  const signOut = () => {
    guestAuthApi.logout().catch(() => undefined);
    setSignedIn(false);
    navigate('/book');
  };

  return (
    <div className="min-h-screen bg-[var(--ns-bg)] text-[var(--ns-ink)]">
      <div className="ns-ambient" aria-hidden="true" />

      <header className="sticky top-0 z-40 border-b border-[var(--ns-glass-line)] bg-[color-mix(in_srgb,var(--ns-bg)_82%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/book" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--ns-gold)] text-white shadow-lg">
              <BedDouble size={20} />
            </span>
            <span className="leading-tight">
              <span className="block font-['Outfit'] text-lg font-extrabold tracking-tight">{villa.name}</span>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ns-muted)]">Book your stay</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <NavLink
              to="/book"
              className={({ isActive }) =>
                `rounded-xl px-3 py-2 text-sm font-semibold transition ${isActive ? 'bg-[var(--ns-gold)] text-white' : 'text-[var(--ns-ink)] hover:bg-[var(--ns-glass-1)]'}`
              }
            >
              <span className="flex items-center gap-1.5"><CalendarDays size={15} /> Book a room</span>
            </NavLink>
            <NavLink
              to="/guest/bookings"
              className={({ isActive }) =>
                `rounded-xl px-3 py-2 text-sm font-semibold transition ${isActive ? 'bg-[var(--ns-gold)] text-white' : 'text-[var(--ns-ink)] hover:bg-[var(--ns-glass-1)]'}`
              }
            >
              My bookings
            </NavLink>
            {signedIn ? (
              <button onClick={signOut} className="rounded-xl px-3 py-2 text-sm font-semibold text-[var(--ns-muted)] hover:bg-[var(--ns-glass-1)]">
                <span className="flex items-center gap-1.5"><LogOut size={15} /> Sign out</span>
              </button>
            ) : (
              <Link to="/guest/login" className="rounded-xl px-3 py-2 text-sm font-semibold text-[var(--ns-ink)] hover:bg-[var(--ns-glass-1)]">
                <span className="flex items-center gap-1.5"><UserRound size={15} /> Sign in</span>
              </Link>
            )}
            <Link
              to="/book"
              className="ml-2 rounded-xl bg-[var(--ns-gold)] px-4 py-2 text-sm font-bold text-white shadow-md transition hover:opacity-90"
            >
              Reserve now
            </Link>
          </nav>

          <button className="rounded-xl p-2 md:hidden" onClick={() => setMenuOpen((open) => !open)} aria-label="Toggle menu" aria-expanded={menuOpen} aria-controls="public-mobile-menu">
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {menuOpen && (
          <div id="public-mobile-menu" className="border-t border-[var(--ns-glass-line)] px-4 py-3 md:hidden">
            <div className="flex flex-col gap-1">
              <Link to="/book" className="rounded-xl px-3 py-2 text-sm font-semibold hover:bg-[var(--ns-glass-1)]">Book a room</Link>
              <Link to="/guest/bookings" className="rounded-xl px-3 py-2 text-sm font-semibold hover:bg-[var(--ns-glass-1)]">My bookings</Link>
              {signedIn ? (
                <button onClick={signOut} className="rounded-xl px-3 py-2 text-left text-sm font-semibold text-[var(--ns-muted)] hover:bg-[var(--ns-glass-1)]">Sign out</button>
              ) : (
                <Link to="/guest/login" className="rounded-xl px-3 py-2 text-sm font-semibold hover:bg-[var(--ns-glass-1)]">Sign in</Link>
              )}
            </div>
          </div>
        )}
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="mt-16 border-t border-[var(--ns-glass-line)] bg-[color-mix(in_srgb,var(--ns-bg)_88%,transparent)]">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-3">
          <div>
            <div className="font-['Outfit'] text-lg font-extrabold">{villa.name}</div>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-[var(--ns-muted)]">
              A calm, contemporary villa stay in the heart of the Volta Region.
            </p>
          </div>
          <div className="space-y-2 text-sm text-[var(--ns-muted)]">
            <div className="flex items-start gap-2"><MapPin size={16} className="mt-0.5 shrink-0" /> {villa.address}</div>
            <div className="flex items-center gap-2"><Phone size={16} /> {villa.phone}</div>
            <div className="flex items-center gap-2"><Mail size={16} /> {villa.email}</div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="font-bold">Guest services</div>
            <div><Link to="/book" className="text-[var(--ns-muted)] hover:text-[var(--ns-gold)]">Book a room</Link></div>
            <div><Link to="/book#lookup" className="text-[var(--ns-muted)] hover:text-[var(--ns-gold)]">Find a booking</Link></div>
            <div><Link to="/guest/login" className="text-[var(--ns-muted)] hover:text-[var(--ns-gold)]">Guest sign in</Link></div>
            <div><Link to="/guest/register" className="text-[var(--ns-muted)] hover:text-[var(--ns-gold)]">Create an account</Link></div>
          </div>
        </div>
        <div className="border-t border-[var(--ns-glass-line)] px-4 py-4 text-center text-xs text-[var(--ns-muted)]">
          © {new Date().getFullYear()} {villa.name}. All rights reserved.
        </div>
      </footer>
    </div>
  );
};
