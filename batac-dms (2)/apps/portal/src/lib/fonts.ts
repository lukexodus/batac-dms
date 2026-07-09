/**
 * apps/portal/src/lib/fonts.ts
 *
 * next/font configuration for the public citizen portal (Phase 3).
 * Set up now to avoid rework when portal is built.
 *
 * Fonts match /apps/web/index.html exactly — same weights, same families.
 * next/font self-hosts the fonts at build time; no runtime Google request.
 *
 * Source: DESIGN.md §3 (typography tokens)
 */
import { Inter, JetBrains_Mono, Lora } from "next/font/google";

/**
 * Inter — primary UI font.
 * Weights: 400, 500, 600, 700. Italic subset for status states.
 * Variable: --font-sans (matches token in globals.css)
 */
export const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-sans",
  display: "swap",
});

/**
 * JetBrains Mono — document numbers, timestamps, QR codes.
 * Weights: 400, 500.
 * Variable: --font-mono
 */
export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal"],
  variable: "--font-mono",
  display: "swap",
});

/**
 * Lora — formal document rendering only.
 * Weight: 400 regular. Loaded here for portal because citizen-facing
 * document lookup pages may render document bodies in serif.
 * In /apps/web, Lora is deferred (loaded per-component only).
 * Variable: --font-serif
 */
export const lora = Lora({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal"],
  variable: "--font-serif",
  display: "swap",
});
