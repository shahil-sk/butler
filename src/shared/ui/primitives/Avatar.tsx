import { cn } from "@/shared/utils";

export function Avatar({
  name,
  src,
  size = 28,
  className,
}: {
  name: string;
  src?: string;
  size?: number;
  className?: string;
}) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full shrink-0 overflow-hidden",
        "bg-primary/15 text-primary font-semibold select-none",
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      title={name}
    >
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        initials
      )}
    </span>
  );
}

export function AvatarGroup({
  items,
  max = 4,
  size = 24,
}: {
  items: { name: string; src?: string }[];
  max?: number;
  size?: number;
}) {
  const visible = items.slice(0, max);
  const overflow = items.length - max;
  return (
    <div className="flex items-center" style={{ gap: -(size * 0.3) }}>
      {visible.map((item, i) => (
        <Avatar
          key={i}
          name={item.name}
          src={item.src}
          size={size}
          className="ring-2 ring-background"
        />
      ))}
      {overflow > 0 && (
        <span
          className="inline-flex items-center justify-center rounded-full ring-2 ring-background bg-surface-2 text-muted-foreground font-semibold select-none"
          style={{ width: size, height: size, fontSize: size * 0.35 }}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
