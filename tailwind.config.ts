import type { Config } from "tailwindcss";

// Palette de marque (CONSTITUTION.md §4)
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Palette de marque DIRA Budget / Shauri (design.md)
        brand: {
          // Tokens de marque — DIRA Budget by Shauri
          ink: "#1e293b", // ardoise profonde (shell, titres)
          primary: "#0fa86b", // émeraude (accent / CTA)
          canvas: "#f8fafc", // fond quasi blanc
          muted: "#64748b", // ardoise atténuée (texte secondaire)
          // Alias conservés pour le code existant → remap sur la palette Shauri
          night: "#1e293b", // ancre foncée → ardoise
          emerald: "#0fa86b", // accent vert → émeraude
          paper: "#f8fafc", // fond doux → canvas
          green: "#0fa86b", // vert secondaire → émeraude
          olive: "#0fa86b", // bordures → émeraude
          lime: "#0fa86b", // surbrillance douce (utilisé en /20) → émeraude
          brown: "#1e293b", // texte foncé → ardoise
          cream: "#e8f5ee", // interlude chaud → émeraude pâle
          terracotta: "#dc2626", // accent rouge → alerte
        },
        // Conventions de couleur métier (CONSTITUTION §4)
        input: "#1d4ed8", // saisie utilisateur = bleu
        formula: "#0f172a", // calcul = noir
        alert: "#dc2626", // écart / dépassement = rouge
      },
      fontFamily: {
        heading: ["Inter", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
