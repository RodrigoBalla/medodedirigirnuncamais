import { createContext, useContext, useEffect } from "react";

// Tema travado em dark — paleta navy + amarelo. O contexto continua existindo
// pra não quebrar componentes que importam useTheme(), mas isDark é sempre
// true e toggleTheme é no-op.

interface ThemeContextType {
  theme: "dark";
  toggleTheme: () => void;
  isDark: true;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  toggleTheme: () => {},
  isDark: true,
});

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Garante a classe `dark` no <html> em todo render — defensivo.
    document.documentElement.classList.add("dark");
    // Remove qualquer preferência antiga salva (sem mais opção de claro)
    try {
      localStorage.removeItem("app-theme");
    } catch {}
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: "dark", toggleTheme: () => {}, isDark: true }}>
      {children}
    </ThemeContext.Provider>
  );
}
