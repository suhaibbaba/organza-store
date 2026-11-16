import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PageAction } from './PageAction';
import classes from './PageHeader.module.css';

/**
 * The clinic's page header: title 22/30 medium in deep teal, an optional subtitle, actions at
 * the end and an optional count badge. `primary` is the page's main button: it moves into the
 * top bar on wide screens. `back` is the link above detail pages (there are no breadcrumbs).
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  primary,
  count,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  primary?: ReactNode;
  count?: ReactNode;
  back?: { to: string; label: string };
}) {
  const { i18n } = useTranslation();
  const Chevron = i18n.dir() === 'rtl' ? IconChevronRight : IconChevronLeft;
  return (
    <div className={classes.wrap}>
      {back && (
        <Link to={back.to} className={classes.back}>
          <Chevron size={16} />
          {back.label}
        </Link>
      )}
      <header className={classes.header}>
        <div className={classes.titles}>
          <h1 className={classes.title}>{title}</h1>
          {subtitle && <p className={classes.subtitle}>{subtitle}</p>}
        </div>
        {(actions || primary || count) && (
          <div className={classes.actions}>
            {count && <span className={`${classes.count} o-wash`}>{count}</span>}
            {actions}
            {primary && <PageAction>{primary}</PageAction>}
          </div>
        )}
      </header>
    </div>
  );
}

/** The back link above a detail page whose header is laid out by the page itself. */
export function BackLink({ to, label }: { to: string; label: string }) {
  const { i18n } = useTranslation();
  const Chevron = i18n.dir() === 'rtl' ? IconChevronRight : IconChevronLeft;
  return (
    <Link to={to} className={classes.back}>
      <Chevron size={16} />
      {label}
    </Link>
  );
}
