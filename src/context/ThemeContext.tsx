import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface ThemeContextType {
  bgColor: string;
  setBgColor: (color: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const colorPresets = [
  { bg: "", label: "Default" },
  { bg: "#1a1a2e", label: "Dark Navy" },
  { bg: "#0f0f0f", label: "Pure Dark" },
  { bg: "#1e3a5f", label: "Ocean" },
  { bg: "#2d1b4e", label: "Purple" },
  { bg: "#1b2e1b", label: "Forest" },
  { bg: "#3e1929", label: "Wine" },
  { bg: "#f5f0e8", label: "Cream" },
  { bg: "#e8f0f5", label: "Ice" },
];

export { colorPresets };

function getContrastColor(hex: string): "light" | "dark" {
  if (!hex) return "light";
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "light" : "dark";
}

function hexToHSL(hex: string): string {
  const c = hex.replace("#", "");
  let r = parseInt(c.substring(0, 2), 16) / 255;
  let g = parseInt(c.substring(2, 4), 16) / 255;
  let b = parseInt(c.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function adjustLightness(hsl: string, amount: number): string {
  const parts = hsl.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
  if (!parts) return hsl;
  const newL = Math.min(100, Math.max(0, parseInt(parts[3]) + amount));
  return `${parts[1]} ${parts[2]}% ${newL}%`;
}

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [bgColor, setBgColorState] = useState("");

  const loadColor = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("bg_color").eq("user_id", user.id).maybeSingle();
    if (data?.bg_color) setBgColorState(data.bg_color);
  }, [user]);

  useEffect(() => {
    loadColor();
  }, [loadColor]);

  useEffect(() => {
    if (bgColor) {
      // Convert hex to HSL and set as --background so all bg-background usage picks it up
      const hsl = hexToHSL(bgColor);
      document.documentElement.style.setProperty("--background", hsl);
      const mode = getContrastColor(bgColor);
      if (mode === "dark") {
        document.documentElement.classList.add("dark");
        document.documentElement.style.setProperty("--foreground", "210 40% 98%");
        document.documentElement.style.setProperty("--card", `${adjustLightness(hsl, 4)}`);
        document.documentElement.style.setProperty("--card-foreground", "210 40% 98%");
        document.documentElement.style.setProperty("--muted", `${adjustLightness(hsl, 8)}`);
        document.documentElement.style.setProperty("--muted-foreground", "215 20% 65%");
        document.documentElement.style.setProperty("--border", `${adjustLightness(hsl, 10)}`);
        document.documentElement.style.setProperty("--input", `${adjustLightness(hsl, 10)}`);
        document.documentElement.style.setProperty("--accent", `${adjustLightness(hsl, 8)}`);
        document.documentElement.style.setProperty("--accent-foreground", "210 40% 98%");
        document.documentElement.style.setProperty("--popover", `${adjustLightness(hsl, 4)}`);
        document.documentElement.style.setProperty("--popover-foreground", "210 40% 98%");
        document.documentElement.style.setProperty("--secondary", `${adjustLightness(hsl, 10)}`);
        document.documentElement.style.setProperty("--secondary-foreground", "210 40% 98%");
      } else {
        document.documentElement.classList.remove("dark");
        document.documentElement.style.setProperty("--foreground", "224 71% 4%");
        document.documentElement.style.setProperty("--card", "0 0% 100%");
        document.documentElement.style.setProperty("--card-foreground", "224 71% 4%");
        document.documentElement.style.setProperty("--muted", "220 14% 96%");
        document.documentElement.style.setProperty("--muted-foreground", "220 9% 46%");
        document.documentElement.style.setProperty("--border", "220 13% 91%");
        document.documentElement.style.setProperty("--input", "220 13% 91%");
        document.documentElement.style.setProperty("--accent", "234 89% 96%");
        document.documentElement.style.setProperty("--accent-foreground", "234 89% 63%");
        document.documentElement.style.setProperty("--popover", "0 0% 100%");
        document.documentElement.style.setProperty("--popover-foreground", "224 71% 4%");
        document.documentElement.style.setProperty("--secondary", "220 14% 96%");
        document.documentElement.style.setProperty("--secondary-foreground", "224 71% 4%");
      }
    } else {
      // Reset all to defaults
      const props = ["--background", "--foreground", "--card", "--card-foreground", "--muted", "--muted-foreground", "--border", "--input", "--accent", "--accent-foreground", "--popover", "--popover-foreground", "--secondary", "--secondary-foreground"];
      props.forEach(p => document.documentElement.style.removeProperty(p));
      document.documentElement.classList.remove("dark");
    }
  }, [bgColor]);

  const setBgColor = async (color: string) => {
    setBgColorState(color);
    if (user) {
      await supabase.from("profiles").update({ bg_color: color }).eq("user_id", user.id);
    }
  };

  return (
    <ThemeContext.Provider value={{ bgColor, setBgColor }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
};
