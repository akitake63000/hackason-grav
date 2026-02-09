import Link from "next/link";
import styles from "./page-shell.module.css";

type PageShellProps = {
  title: string;
  description?: string;
  badge?: string;
  children?: React.ReactNode;
};

export default function PageShell({
  title,
  description,
  badge,
  children,
}: PageShellProps) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <nav className={styles.nav}>
          <Link href="/">Home</Link>
          <Link href="/login">Login</Link>
          <Link href="/checkin">Check-in</Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/food-sniper">Food Sniper</Link>
          <Link href="/mental-shield">Mental Shield</Link>
        </nav>
        {badge ? <div className={styles.badge}>{badge}</div> : null}
        <h1 className={styles.title}>{title}</h1>
        {description ? (
          <p className={styles.description}>{description}</p>
        ) : null}
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}
