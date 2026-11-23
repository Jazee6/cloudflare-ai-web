const STAGGER_MS = 50;

/** Reveals text word by word with a fade, rise and blur. Remount (via `key`) to replay. */
export function TextEffect({ children, className }: { children: string; className?: string }) {
  let wordIndex = 0;

  return (
    <p className={className}>
      <span className="sr-only">{children}</span>
      {children.split(/(\s+)/).map((segment, index) => {
        const delay = /^\s*$/.test(segment) ? 0 : wordIndex++ * STAGGER_MS;
        return (
          <span
            key={index}
            aria-hidden="true"
            className="inline-block whitespace-pre motion-safe:animate-text-reveal"
            style={{ animationDelay: `${delay}ms` }}
          >
            {segment}
          </span>
        );
      })}
    </p>
  );
}
