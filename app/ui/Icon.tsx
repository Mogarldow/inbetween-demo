// Ikony Material Symbols (Google Fonts), stejný styl jako aplikace Googlu.
export function Icon({ name, size = 20, fill = false }: { name: string; size?: number; fill?: boolean }) {
  return (
    <span className="ms" aria-hidden="true" style={{ fontSize: size, fontVariationSettings: `'FILL' ${fill ? 1 : 0}` }}>
      {name}
    </span>
  );
}

const AV_COLORS = ["#1A73E8", "#188038", "#E37400", "#A142F4", "#D93025", "#12B5CB"];
/** Kulatý avatar s iniciálami jako v Kontaktech Google. */
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const parts = name.replace(/[.]/g, "").split(" ").filter(Boolean);
  const initials = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  const color = AV_COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AV_COLORS.length];
  return (
    <span className="avatar" aria-hidden="true" style={{ width: size, height: size, background: color, fontSize: size * 0.42 }}>
      {initials.toUpperCase()}
    </span>
  );
}

export function Logo() {
  return (
    <span className="logo-mark" aria-hidden="true">
      <Icon name="psychology" size={26} fill />
    </span>
  );
}
