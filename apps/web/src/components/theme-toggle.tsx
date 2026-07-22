import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, Monitor, Moon, Sun } from "lucide-react";

import { useUiStore } from "../stores/ui-store.js";
import type { ThemeMode } from "../theme.js";

type ThemeChoice = {
  icon: typeof Moon;
  label: string;
  mode: ThemeMode;
};

const choices: Record<ThemeMode, ThemeChoice> = {
  dark: { icon: Moon, label: "暗黑", mode: "dark" },
  light: { icon: Sun, label: "亮色", mode: "light" },
  system: { icon: Monitor, label: "跟随系统", mode: "system" },
};

const choiceList = [choices.dark, choices.light, choices.system];

export function ThemeToggle() {
  const mode = useUiStore((state) => state.themeMode);
  const setMode = useUiStore((state) => state.setThemeMode);
  const current = choices[mode];
  const CurrentIcon = current.icon;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          aria-label={`主题：${current.label}`}
          className={`theme-toggle theme-toggle-${mode}`}
          title={`主题：${current.label}`}
          type="button"
        >
          <CurrentIcon aria-hidden="true" size={16} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          aria-label="选择主题"
          className="theme-menu"
          sideOffset={8}
        >
          <DropdownMenu.Label className="theme-menu-label">
            外观主题
          </DropdownMenu.Label>
          <DropdownMenu.RadioGroup
            onValueChange={(value) => setMode(value as ThemeMode)}
            value={mode}
          >
            {choiceList.map((choice) => {
              const Icon = choice.icon;
              return (
                <DropdownMenu.RadioItem
                  className="theme-menu-item"
                  key={choice.mode}
                  value={choice.mode}
                >
                  <Icon aria-hidden="true" size={16} />
                  <span>{choice.label}</span>
                  <DropdownMenu.ItemIndicator className="theme-menu-check">
                    <Check aria-hidden="true" size={15} />
                  </DropdownMenu.ItemIndicator>
                </DropdownMenu.RadioItem>
              );
            })}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
