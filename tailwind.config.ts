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
        // Palette de marque Terra Mucho (logo)
        brand: {
          // Palette nommée
          lime: "#b7c84a", // vert clair (primaire)
          olive: "#a0b44e", // vert olive (primaire)
          terracotta: "#9b2207", // terre cuite / rouge (primaire)
          brown: "#5c230f", // brun foncé (primaire)
          cream: "#f3e5e0", // crème (secondaire)
          green: "#7e9d3d", // vert moyen (secondaire)
          // Alias conservés pour le code existant (remap des hex de marque)
          night: "#5c230f", // ancre foncée → brun (ex bleu nuit)
          emerald: "#7e9d3d", // accent vert (ex émeraude)
          paper: "#f3e5e0", // fond doux → crème (ex blanc cassé)
        },
        // Conventions de couleur métier (CONSTITUTION §4)
        input: "#1d4ed8", // saisie utilisateur = bleu
        formula: "#0f172a", // calcul = noir
        alert: "#9b2207", // écart / dépassement = rouge terre cuite (marque)
      },
      fontFamily: {
        heading: ["Montserrat", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
