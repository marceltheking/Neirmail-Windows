import { Moon, Sun } from "@phosphor-icons/react";
import { useThemeStore } from "../../lib/state/themeStore";
import { IconButton } from "../ui/IconButton";

export function ThemeToggle() {
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  return (
    <IconButton label={label} icon={theme === "dark" ? <Moon /> : <Sun />} onClick={toggleTheme} />
  );
}
