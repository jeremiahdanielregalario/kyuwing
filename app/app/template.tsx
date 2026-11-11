/** Re-mounts on every top-level app navigation so each page eases in. */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
