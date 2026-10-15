// Logo de MakeIt (client/public/makeit-logo.png, 128 px: nítido hasta 64 px
// en pantallas de alta densidad). Decorativo: siempre va junto al texto "MakeIt".
export function Logo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <img
      src="/makeit-logo.png"
      alt=""
      width={128}
      height={128}
      className={`shrink-0 rounded-lg object-cover ${className}`}
    />
  );
}
