import {
  Bell,
  ContactlessPayment,
  Database,
  Fingerprint,
  Funnel,
  Gear,
  Key,
  LockKey,
  ShieldCheck,
  SlidersHorizontal,
  UserCircle,
  Users,
} from "@phosphor-icons/react";
import { Link, Redirect, useParams } from "wouter";
import { SessionsTab } from "./SessionsTab";
import { PgpTab } from "./PgpTab";
import { AppPasswordsTab } from "./AppPasswordsTab";
import { PreferencesTab } from "./PreferencesTab";
import { StorageTab } from "./StorageTab";
import { AboutTab } from "./AboutTab";
import { FiltersTab } from "./FiltersTab";
import { ContactsTab } from "./ContactsTab";
import { SecurityTab } from "./SecurityTab";
import { AccountTab } from "./AccountTab";
import { DesktopTab } from "./DesktopTab";
import { ErrorBoundary } from "../shared/ErrorBoundary";

const sections = [
  { key: "preferences", label: "Preferences", icon: SlidersHorizontal, group: "Mail" },
  { key: "filters", label: "Filters", icon: Funnel, group: "Mail" },
  { key: "contacts", label: "Contacts", icon: Users, group: "Mail" },
  { key: "security", label: "Security", icon: ShieldCheck, group: "Security" },
  { key: "sessions", label: "Sessions", icon: Fingerprint, group: "Security" },
  { key: "pgp", label: "PGP key", icon: LockKey, group: "Security" },
  { key: "app-passwords", label: "App passwords", icon: Key, group: "Security" },
  { key: "desktop", label: "Desktop app", icon: Bell, group: "Application" },
  { key: "storage", label: "Local storage", icon: Database, group: "Application" },
  { key: "account", label: "Account", icon: UserCircle, group: "Account" },
  { key: "about", label: "About Neir Mail", icon: Gear, group: "Account" },
] as const;

const views: Record<string, React.ReactNode> = {
  preferences: <PreferencesTab />,
  filters: <FiltersTab />,
  contacts: <ContactsTab />,
  security: <SecurityTab />,
  sessions: <SessionsTab />,
  pgp: <PgpTab />,
  "app-passwords": <AppPasswordsTab />,
  desktop: <DesktopTab />,
  storage: <StorageTab />,
  account: <AccountTab />,
  about: <AboutTab />,
};

export function SettingsPage() {
  const { section = "preferences" } = useParams();
  if (!views[section]) return <Redirect to="/settings/preferences" replace />;

  return (
    <div className="settings-page settings-page-v2">
      <aside className="settings-nav" aria-label="Settings sections">
        <div className="settings-nav-head">
          <ContactlessPayment weight="duotone" />
          <div>
            <strong>Settings</strong>
            <span>Neir Mail and account</span>
          </div>
        </div>
        {["Mail", "Security", "Application", "Account"].map((group) => (
          <div className="settings-nav-group" key={group}>
            <span className="settings-nav-label">{group}</span>
            {sections
              .filter((item) => item.group === group)
              .map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    to={`/settings/${item.key}`}
                    className={`settings-nav-item${section === item.key ? " active" : ""}`}
                    key={item.key}
                    aria-current={section === item.key ? "page" : undefined}
                  >
                    <Icon weight={section === item.key ? "fill" : "regular"} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
          </div>
        ))}
      </aside>
      <section className="settings-content">
        <ErrorBoundary key={section} scope="section">
          {views[section]}
        </ErrorBoundary>
      </section>
    </div>
  );
}
