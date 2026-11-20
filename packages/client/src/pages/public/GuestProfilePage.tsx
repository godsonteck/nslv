import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  UserRound,
  Mail,
  Phone,
  ShieldCheck,
  CheckCircle2,
  Sliders,
  LogOut,
  Heart,
  Moon,
  Coffee,
  Thermometer,
  Shield,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import {
  guestAuthApi,
  guestSession,
  type GuestAccount,
} from '../../services/publicApi';
import { villaAssets } from '../../assets';

const PREFS_KEY = 'nslv_guest_preferences';

interface GuestPreferences {
  pillow: string;
  dietary: string;
  roomTemp: string;
  morningCoffee: string;
}

export const GuestProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const [account, setAccount] = useState<GuestAccount | null>(null);
  const [prefsSaved, setPrefsSaved] = useState(false);
  const [prefs, setPrefs] = useState<GuestPreferences>(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      return raw
        ? JSON.parse(raw)
        : {
            pillow: 'Down Feather',
            dietary: 'None',
            roomTemp: '22°C (Balanced)',
            morningCoffee: 'Cappuccino with Oat Milk',
          };
    } catch {
      return {
        pillow: 'Down Feather',
        dietary: 'None',
        roomTemp: '22°C (Balanced)',
        morningCoffee: 'Cappuccino with Oat Milk',
      };
    }
  });

  const signedIn = guestSession.hasSession();

  useEffect(() => {
    if (signedIn) {
      guestAuthApi.me().then(setAccount).catch(() => null);
    }
  }, [signedIn]);

  const savePreference = (key: keyof GuestPreferences, val: string) => {
    const updated = { ...prefs, [key]: val };
    setPrefs(updated);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(updated));
      setPrefsSaved(true);
      setTimeout(() => setPrefsSaved(false), 2000);
    } catch {
      // Ignore
    }
  };

  const handleLogout = () => {
    guestSession.clear();
    navigate('/book');
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-5 space-y-5">
      {/* Profile Header */}
      <div className="rounded-3xl border border-[var(--ns-glass-line)] bg-[var(--ns-glass-1)] p-5 shadow-sm">
        {signedIn && account ? (
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[var(--ns-gold)] text-white font-['Outfit'] text-2xl font-black shadow-md">
              {account.firstName?.[0] || 'G'}
              {account.lastName?.[0] || ''}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-['Outfit'] text-lg font-bold text-[var(--ns-ink)] truncate">
                  {account.firstName} {account.lastName}
                </h2>
                {account.emailVerified && (
                  <span title="Verified Resident">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--ns-muted)] truncate flex items-center gap-1.5 mt-0.5">
                <Mail size={13} /> {account.email}
              </p>
              {account.phone && (
                <p className="text-xs text-[var(--ns-muted)] truncate flex items-center gap-1.5 mt-0.5">
                  <Phone size={13} /> {account.phone}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-4 space-y-3">
            <img
              src={villaAssets.logo}
              alt="NS Luxury Villa"
              className="mx-auto h-16 w-16 rounded-2xl object-cover border border-[var(--ns-glass-line)] shadow-md"
            />
            <div>
              <h3 className="font-['Outfit'] text-base font-bold text-[var(--ns-ink)]">
                NS Luxury Villa
              </h3>
              <p className="text-[11px] font-semibold text-[var(--ns-gold)]">
                Arrive as a Guest, Stay as Family
              </p>
              <p className="text-xs text-[var(--ns-muted)] max-w-xs mx-auto mt-1">
                Ho, Volta Region, Ghana
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Link
                to="/guest/login"
                className="rounded-xl bg-[var(--ns-gold)] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:opacity-95"
              >
                Sign In
              </Link>
              <Link
                to="/guest/register"
                className="rounded-xl border border-[var(--ns-glass-line)] bg-[var(--ns-glass-2)] px-5 py-2.5 text-xs font-bold text-[var(--ns-ink)] hover:bg-[var(--ns-glass-3)]"
              >
                Create Account
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Hospitality Preferences Section */}
      <div className="rounded-3xl border border-[var(--ns-glass-line)] bg-[var(--ns-glass-1)] p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={17} className="text-[var(--ns-gold)]" />
            <h3 className="font-['Outfit'] text-sm font-bold text-[var(--ns-ink)]">
              Stay & Room Preferences
            </h3>
          </div>
          {prefsSaved && (
            <span className="text-[11px] font-bold text-emerald-500 animate-fade-in flex items-center gap-1">
              <CheckCircle2 size={13} /> Saved
            </span>
          )}
        </div>
        <p className="text-[11px] text-[var(--ns-muted)]">
          Our butler & concierge team adapts your villa environment according to these selections.
        </p>

        {/* Pillow Menu */}
        <div>
          <label className="block text-xs font-bold text-[var(--ns-muted)] mb-1.5 flex items-center gap-1.5">
            <Moon size={14} /> Pillow Menu Preference
          </label>
          <select
            value={prefs.pillow}
            onChange={(e) => savePreference('pillow', e.target.value)}
            className="w-full rounded-xl border border-[var(--ns-glass-line)] bg-[var(--ns-glass-2)] px-3 py-2.5 text-xs text-[var(--ns-ink)] outline-none focus:border-[var(--ns-gold)] font-medium"
          >
            <option value="Down Feather">Down Feather (Plush & Soft)</option>
            <option value="Memory Foam">Contoured Memory Foam (Firm Support)</option>
            <option value="Organic Bamboo">Organic Bamboo Cooling Pillow</option>
            <option value="Hypoallergenic">Hypoallergenic Microfiber</option>
          </select>
        </div>

        {/* Climate */}
        <div>
          <label className="block text-xs font-bold text-[var(--ns-muted)] mb-1.5 flex items-center gap-1.5">
            <Thermometer size={14} /> Preferred Suite Climate
          </label>
          <select
            value={prefs.roomTemp}
            onChange={(e) => savePreference('roomTemp', e.target.value)}
            className="w-full rounded-xl border border-[var(--ns-glass-line)] bg-[var(--ns-glass-2)] px-3 py-2.5 text-xs text-[var(--ns-ink)] outline-none focus:border-[var(--ns-gold)] font-medium"
          >
            <option value="20°C (Crisp & Cool)">20°C (Crisp & Cool)</option>
            <option value="22°C (Balanced)">22°C (Balanced Comfort)</option>
            <option value="24°C (Gentle Warmth)">24°C (Gentle Warmth)</option>
          </select>
        </div>

        {/* Dietary */}
        <div>
          <label className="block text-xs font-bold text-[var(--ns-muted)] mb-1.5 flex items-center gap-1.5">
            <Heart size={14} /> Dietary Preferences
          </label>
          <select
            value={prefs.dietary}
            onChange={(e) => savePreference('dietary', e.target.value)}
            className="w-full rounded-xl border border-[var(--ns-glass-line)] bg-[var(--ns-glass-2)] px-3 py-2.5 text-xs text-[var(--ns-ink)] outline-none focus:border-[var(--ns-gold)] font-medium"
          >
            <option value="None">No Dietary Restrictions</option>
            <option value="Vegetarian">Vegetarian</option>
            <option value="Vegan">Vegan</option>
            <option value="Halal">Halal</option>
            <option value="Gluten-Free">Gluten-Free</option>
            <option value="No Shellfish / Seafood">No Shellfish / Seafood</option>
          </select>
        </div>

        {/* Morning Coffee */}
        <div>
          <label className="block text-xs font-bold text-[var(--ns-muted)] mb-1.5 flex items-center gap-1.5">
            <Coffee size={14} /> Morning Beverage Style
          </label>
          <input
            type="text"
            placeholder="e.g. Double Espresso, Green Tea, Cappuccino with Almond Milk"
            value={prefs.morningCoffee}
            onChange={(e) => savePreference('morningCoffee', e.target.value)}
            className="w-full rounded-xl border border-[var(--ns-glass-line)] bg-[var(--ns-glass-2)] px-3 py-2 text-xs text-[var(--ns-ink)] outline-none focus:border-[var(--ns-gold)] font-medium"
          />
        </div>
      </div>

      {/* Villa Contact & Location Details */}
      <div className="rounded-3xl border border-[var(--ns-glass-line)] bg-[var(--ns-glass-1)] p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-3">
          <img
            src={villaAssets.logo}
            alt="NS Luxury Villa"
            className="h-10 w-10 rounded-xl object-cover border border-[var(--ns-glass-line)]"
          />
          <div>
            <h4 className="font-['Outfit'] text-sm font-bold text-[var(--ns-ink)]">NS Luxury Villa</h4>
            <p className="text-[11px] text-[var(--ns-gold)] font-semibold">Arrive as a Guest, Stay as Family</p>
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-[var(--ns-glass-line)] text-xs text-[var(--ns-muted)]">
          <div className="flex items-start gap-2">
            <span className="font-semibold text-[var(--ns-ink)] shrink-0">Address:</span>
            <span>VH-0102-0933, Torgbui Sapeh St, Ho, Volta Region, Ghana</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[var(--ns-ink)] shrink-0">Phone:</span>
            <a href="tel:+233535572774" className="text-[var(--ns-gold)] font-bold hover:underline">+233 535 572 774</a>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[var(--ns-ink)] shrink-0">Email:</span>
            <a href="mailto:nsvilla4u@gmail.com" className="text-[var(--ns-gold)] hover:underline">nsvilla4u@gmail.com</a>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[var(--ns-ink)] shrink-0">Website:</span>
            <a href="https://www.nsvilla.com" target="_blank" rel="noreferrer" className="text-[var(--ns-gold)] hover:underline">www.nsvilla.com</a>
          </div>
        </div>
      </div>

      {/* Sign Out Button */}
      {signedIn && (
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 py-3 text-xs font-bold text-rose-500 hover:bg-rose-500/20 transition active:scale-95"
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      )}

    </div>
  );
};
