// Marque Shauri — logo officiel (fond transparent).
export function ShauriLogo({ className = "h-10 w-auto" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/shauri-mark.png" alt="Shauri" className={className} />
  );
}
