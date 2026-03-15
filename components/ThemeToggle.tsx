"use client";

import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("dark");

  useEffect(() => {
    const savedTheme = (localStorage.getItem("studybuddy-theme") as ThemeMode | null) ?? "dark";
    document.documentElement.dataset.theme = savedTheme;
    setTheme(savedTheme);
  }, []);

  function toggleTheme() {
    const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("studybuddy-theme", nextTheme);
    setTheme(nextTheme);
  }

  return (
    <button
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="theme-toggle"
      onClick={toggleTheme}
      type="button"
    >
      <span aria-hidden="true" className="theme-toggle__thumb">
        {theme === "dark" ? (
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M20.7 14.3A8.5 8.5 0 0 1 9.7 3.3a8.5 8.5 0 1 0 11 11Z"
              fill="currentColor"
            />
          </svg>
        ) : (
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="12" cy="12" fill="currentColor" r="4" />
            <path
              d="M12 2.75v2.1M12 19.15v2.1M5.46 5.46l1.49 1.49M17.05 17.05l1.49 1.49M2.75 12h2.1M19.15 12h2.1M5.46 18.54l1.49-1.49M17.05 6.95l1.49-1.49"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.8"
            />
          </svg>
        )}
      </span>
    </button>
  );
}
