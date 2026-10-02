import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  EnvelopeSimple,
  GridFour,
  LockSimple,
  Moon,
  PenNib,
  SignOut,
  SlidersHorizontal,
  Sun,
} from "@phosphor-icons/react";
import { Link, useLocation } from "wouter";
import { NeirLogo } from "../shared/NeirLogo";
import { Tooltip } from "../ui/Tooltip";
import { useAuthStore } from "../../lib/state/authStore";
import { useComposeStore } from "../../lib/state/composeStore";
import { useThemeStore } from "../../lib/state/themeStore";
import { primaryAddress, useAddresses } from "../../lib/hooks/useAddresses";

export function AppDock() {
  const me = useAuthStore((state) => state.me);
  const logout = useAuthStore((state) => state.logout);
  const lock = useAuthStore((state) => state.lock);
  const address = primaryAddress(useAddresses())?.address;
  const openCompose = useComposeStore((state) => state.open);
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const avatar = (address || "N").slice(0, 1).toUpperCase();

  return (
    <aside className="app-dock" aria-label="App navigation">
      <div className="app-dock-brand">
        <div className="app-dock-logo">
          <NeirLogo />
        </div>
        <span className="app-dock-brand-name">Neir Mail</span>
      </div>
      <Tooltip content="Compose" side="right">
        <button
          type="button"
          className="app-dock-compose"
          aria-label="Compose"
          onClick={() => openCompose()}
        >
          <PenNib weight="fill" />
          <span className="app-dock-label">Compose</span>
        </button>
      </Tooltip>
      <nav className="app-dock-nav">
        <DockLink to="/mail/inbox" label="Mail" icon={<EnvelopeSimple weight="duotone" />} />
        <DockLink to="/dashboard" label="Dashboard" icon={<GridFour weight="duotone" />} />
        <DockLink
          to="/settings/preferences"
          label="Settings"
          icon={<SlidersHorizontal weight="duotone" />}
        />
      </nav>
      <div className="app-dock-bottom">
        <Tooltip content={theme === "dark" ? "Light theme" : "Dark theme"} side="right">
          <button
            type="button"
            className="app-dock-action"
            aria-label={theme === "dark" ? "Use light theme" : "Use dark theme"}
            onClick={toggleTheme}
          >
            {theme === "dark" ? <Sun weight="fill" /> : <Moon weight="fill" />}
            <span className="app-dock-label">
              {theme === "dark" ? "Light theme" : "Dark theme"}
            </span>
          </button>
        </Tooltip>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger className="app-dock-avatar" aria-label="Account menu">
            <span className="app-dock-avatar-mark">{avatar}</span>
            <strong className="app-dock-label">Account</strong>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="app-account-menu"
              side="right"
              sideOffset={10}
              align="end"
            >
              <div className="app-account-summary">
                <strong>{address || "Private account"}</strong>
                <span>{me?.plan === "pro" ? "Neir Pro" : "Free plan"}</span>
              </div>
              <DropdownMenu.Separator className="app-menu-separator" />
              <DropdownMenu.Item className="app-menu-item" onSelect={lock}>
                <LockSimple />
                Lock now
                <kbd className="app-menu-kbd">Ctrl L</kbd>
              </DropdownMenu.Item>
              <DropdownMenu.Item className="app-menu-item" onSelect={() => void logout()}>
                <SignOut />
                Log out
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </aside>
  );
}

function DockLink({ to, label, icon }: { to: string; label: string; icon: React.ReactNode }) {
  const [location] = useLocation();
  const section = to.split("/")[1];
  const isActive = location === to || location.startsWith(`/${section}/`);

  return (
    <Tooltip content={label} side="right">
      <Link
        to={to}
        className={`app-dock-link${isActive ? " is-active" : ""}`}
        aria-label={label}
        aria-current={isActive ? "page" : undefined}
      >
        {icon}
        <span className="app-dock-label">{label}</span>
      </Link>
    </Tooltip>
  );
}
