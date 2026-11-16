import { IconChevronLeft, IconChevronRight, type Icon } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import classes from './Widgets.module.css';

export type Tone = 'neutral' | 'success' | 'warning' | 'danger';

/** The clinic's KPI card: a wash label with an icon, a 22px figure, an optional foot line. */
export function StatCard({
  label,
  icon: IconCmp,
  value,
  tone = 'neutral',
  foot,
  to,
}: {
  label: ReactNode;
  icon?: Icon;
  value: ReactNode;
  tone?: Tone;
  foot?: ReactNode;
  to?: string;
}) {
  const body = (
    <>
      <div className={classes.statTop}>
        <span className={`${classes.washBadge} o-wash`}>
          {IconCmp && <IconCmp size={14} />}
          {label}
        </span>
      </div>
      <div className={`${classes.figure} ${classes[tone]}`}>{value}</div>
      {foot && <div className={classes.foot}>{foot}</div>}
    </>
  );
  return to ? (
    <Link to={to} className={`${classes.stat} ${classes.statLink}`}>
      {body}
    </Link>
  ) : (
    <div className={classes.stat}>{body}</div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className={classes.statGrid}>{children}</div>;
}

/** A dashboard panel: a 14px bold title, an optional link or action at the end, then content. */
export function Widget({
  title,
  action,
  link,
  children,
  flush,
}: {
  title: ReactNode;
  action?: ReactNode;
  link?: { to: string; label: string };
  children: ReactNode;
  flush?: boolean;
}) {
  return (
    <section className={flush ? `${classes.widget} ${classes.flush}` : classes.widget}>
      <div className={classes.widgetHead}>
        <h2 className={classes.widgetTitle}>{title}</h2>
        {action}
        {link && <SeeAll to={link.to} label={link.label} />}
      </div>
      <div className={classes.widgetBody}>{children}</div>
    </section>
  );
}

export function SeeAll({ to, label }: { to: string; label: string }) {
  const { i18n } = useTranslation();
  const Chevron = i18n.dir() === 'rtl' ? IconChevronLeft : IconChevronRight;
  return (
    <Link to={to} className={classes.seeAll}>
      {label}
      <Chevron size={16} />
    </Link>
  );
}

/** The greeting banner (the clinic's "banner wash"). */
export function Banner({
  title,
  subtitle,
  end,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  end?: ReactNode;
}) {
  return (
    <section className={classes.banner}>
      <div>
        <h1 className={classes.bannerTitle}>{title}</h1>
        {subtitle && <p className={classes.bannerSub}>{subtitle}</p>}
      </div>
      {end}
    </section>
  );
}

/** A row in a widget list: label (and detail) at the start, a value or badge at the end. */
export function WidgetRow({
  to,
  start,
  label,
  detail,
  end,
}: {
  to?: string;
  start?: ReactNode;
  label: ReactNode;
  detail?: ReactNode;
  end?: ReactNode;
}) {
  const body = (
    <>
      {start}
      <span className={classes.rowText}>
        <span className={classes.rowLabel}>{label}</span>
        {detail && <span className={classes.rowDetail}>{detail}</span>}
      </span>
      {end && <span className={classes.rowEnd}>{end}</span>}
    </>
  );
  return to ? (
    <Link to={to} className={`${classes.row} ${classes.rowLink}`}>
      {body}
    </Link>
  ) : (
    <div className={classes.row}>{body}</div>
  );
}

const TINT_COUNT = 6;
const SIZE_CLASS = { sm: classes.initialsSm, md: classes.initialsMd, lg: classes.initialsLg };

/** Initials on a tint chosen from the name, so a person keeps the same colour everywhere. */
export function Initials({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.codePointAt(0)!) % 1000003;
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('');
  return (
    <span className={`${classes.initials} ${SIZE_CLASS[size]}`} data-tint={hash % TINT_COUNT}>
      {letters || '?'}
    </span>
  );
}
