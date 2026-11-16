import { Collapse, Drawer, Menu, UnstyledButton } from '@mantine/core';
import { useDisclosure, useHotkeys, useMediaQuery } from '@mantine/hooks';
import { Spotlight, spotlight, type SpotlightActionData } from '@mantine/spotlight';
import { LANGUAGES, type Language } from '@organza/shared';
import {
  IconBell,
  IconCheck,
  IconChevronDown,
  IconLanguage,
  IconLogout,
  IconMenu2,
  IconSearch,
  IconX,
} from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { setLanguage } from '@web/i18n';
import { useSession } from '@web/modules/auth/session';
import { useToday } from '@web/modules/reports/api';
import { useApprovals } from '@web/modules/sales/api';
import { PageActionSlot, WIDE } from '@web/shared/components/PageAction';
import { allItems, type NavGroup, type NavItem, visibleGroups } from '../navigation';
import classes from './AppLayout.module.css';

const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? 'dev';

/** Screens that lay out their own scrolling areas (the till, the orders board). */
const FULL_BLEED = ['/pos', '/orders'];

/**
 * The clinic app shell: a 266px rail with the logo, grouped navigation and the user card from
 * 1025px; below that the same navigation in a drawer. A floating top bar holds the screen
 * search, the to-do bell and the page's main button. Only the content column scrolls, never the
 * window (WebView2 and Safari would drag the whole app on a touchpad swipe).
 */
export function AppLayout() {
  const { t, i18n } = useTranslation();
  const { user, can } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const wide = useMediaQuery(WIDE, true, { getInitialValueInEffect: false });
  const [drawer, { open: openDrawer, close: closeDrawer }] = useDisclosure(false);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const groups = useMemo(() => visibleGroups(can), [can]);
  const approvals = useApprovals({ status: 'PENDING' }, true);
  const waiting = can('approvals.request') ? (approvals.data?.pending ?? 0) : 0;
  const actions = useMemo<SpotlightActionData[]>(
    () =>
      allItems(can).map((item) => ({
        id: item.key,
        label: t(item.label),
        leftSection: <item.icon size={18} />,
        onClick: () => void navigate(item.path),
      })),
    [can, t, navigate],
  );
  useHotkeys([['/', () => spotlight.open()]]);
  useEffect(() => closeDrawer(), [location.pathname, closeDrawer]);
  if (!user) return null;
  const fullBleed = FULL_BLEED.includes(location.pathname);

  return (
    <div className={classes.layout}>
      {wide && (
        <aside className={classes.rail}>
          <div className={classes.railInner}>
            <Brand />
            <Nav groups={groups} waiting={waiting} />
            <div className={classes.userSlot}>
              <UserMenu />
            </div>
          </div>
        </aside>
      )}
      <Drawer
        opened={drawer && !wide}
        onClose={closeDrawer}
        size={300}
        position={i18n.dir() === 'rtl' ? 'right' : 'left'}
        withCloseButton={false}
        padding={0}
        classNames={{ content: classes.drawer }}
      >
        <div className={classes.drawerHead}>
          <Brand />
          <UnstyledButton className={classes.iconBtn} onClick={closeDrawer} aria-label="close">
            <IconX size={18} />
          </UnstyledButton>
        </div>
        <div className={classes.drawerBody}>
          <Nav groups={groups} waiting={waiting} />
          <div className={classes.drawerUser}>
            <UserMenu />
          </div>
        </div>
      </Drawer>

      <div className={fullBleed ? classes.columnBleed : `${classes.column} organza-scroll`}>
        <div className={classes.topbarWrap}>
          <header className={classes.topbar}>
            {!wide && (
              <UnstyledButton
                className={classes.iconBtn}
                onClick={openDrawer}
                aria-label={t('nav.menu')}
              >
                <IconMenu2 size={18} />
              </UnstyledButton>
            )}
            {!wide && (
              <Link to="/" className={classes.topLogo} aria-label={t('app.name')}>
                <img src="/brand/mark.png" alt="" width={32} height={32} />
              </Link>
            )}
            <UnstyledButton className={classes.search} onClick={spotlight.open}>
              <IconSearch size={16} className={classes.searchIcon} />
              <span className={classes.searchDivider} />
              <span className={classes.searchText}>{t('nav.searchScreens')}</span>
              <kbd className={classes.kbd}>/</kbd>
            </UnstyledButton>
            <div className={classes.topActions}>
              <Bell />
              <div ref={setSlot} className={classes.pageAction} />
            </div>
          </header>
        </div>
        <main className={fullBleed ? classes.mainBleed : classes.main}>
          <PageActionSlot.Provider value={slot}>
            <Outlet />
          </PageActionSlot.Provider>
        </main>
      </div>

      <Spotlight
        actions={actions}
        shortcut={['mod + K']}
        nothingFound={t('common.empty')}
        searchProps={{ placeholder: t('nav.searchScreens'), leftSection: <IconSearch size={18} /> }}
      />
    </div>
  );
}

function Brand() {
  const { t } = useTranslation();
  return (
    <Link to="/" className={classes.brand} aria-label={t('app.name')}>
      <img src="/brand/mark.png" alt="" width={44} height={44} className={classes.brandMark} />
      <span className={classes.wordmark}>ORGANZA</span>
    </Link>
  );
}

const isUnder = (pathname: string, path: string) =>
  path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`);

/**
 * The menu, as in the clinic's sidebar: home links and one-link sections are plain rows; every
 * other section is an accordion row (tinted icon tile, chevron) whose links sit indented under a
 * guide line. The section holding the current screen opens by itself.
 */
function Nav({ groups, waiting }: { groups: NavGroup[]; waiting: number }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const current = groups.find(
    (g) => g.items.length > 1 && g.key !== 'home' && g.items.some((i) => isUnder(pathname, i.path)),
  )?.key;
  const [open, setOpen] = useState<string[]>(current ? [current] : []);
  useEffect(() => {
    if (current) setOpen((o) => (o.includes(current) ? o : [...o, current]));
  }, [current]);
  const toggle = (key: string) =>
    setOpen((o) => (o.includes(key) ? o.filter((k) => k !== key) : [...o, key]));
  const count = (item: NavItem) =>
    item.key === 'approvals' && waiting > 0 ? (
      <span className={classes.navCount}>{waiting}</span>
    ) : null;

  return (
    <nav className={classes.navList}>
      {groups.map((group) => {
        // Home links and single-link sections are plain rows.
        if (group.key === 'home' || group.items.length === 1)
          return group.items.map((item) => (
            <NavLink
              key={item.key}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                isActive ? `${classes.navItem} ${classes.navActive}` : classes.navItem
              }
            >
              <span className={classes.tile} data-tone={group.tone}>
                <item.icon size={18} />
              </span>
              <span className={classes.navLabel}>{t(item.label)}</span>
              {count(item)}
            </NavLink>
          ));
        const expanded = open.includes(group.key);
        return (
          <div key={group.key}>
            <UnstyledButton
              className={classes.navItem}
              data-open={expanded || undefined}
              data-current={group.key === current || undefined}
              aria-expanded={expanded}
              onClick={() => toggle(group.key)}
            >
              <span className={classes.tile} data-tone={group.tone}>
                <group.icon size={18} />
              </span>
              <span className={classes.navLabel}>{t(group.label)}</span>
              <IconChevronDown size={16} className={classes.chevron} />
            </UnstyledButton>
            <Collapse expanded={expanded}>
              <ul className={classes.children}>
                {group.items.map((item) => (
                  <li key={item.key}>
                    <NavLink
                      to={item.path}
                      // /stock must not light up on /stock/adjustments, which has its own link.
                      end={group.items.some((o) => o.path.startsWith(`${item.path}/`))}
                      className={({ isActive }) =>
                        isActive ? `${classes.child} ${classes.childActive}` : classes.child
                      }
                    >
                      <span className={classes.navLabel}>{t(item.label)}</span>
                      {count(item)}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </Collapse>
          </div>
        );
      })}
    </nav>
  );
}

function UserMenu() {
  const { t, i18n } = useTranslation();
  const { user, signOut } = useSession();
  if (!user) return null;
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('');
  return (
    <Menu position="top-start" width={240}>
      <Menu.Target>
        <UnstyledButton className={classes.userTrigger}>
          <span className={classes.avatar}>{initials}</span>
          <span className={classes.userText}>
            <span className={classes.userName}>{user.name}</span>
            <span className={classes.userRole}>{t(`roles.${user.role}`)}</span>
          </span>
          <IconChevronDown size={18} className={classes.userChevron} />
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>{t('account.language')}</Menu.Label>
        {LANGUAGES.map((language: Language) => (
          <Menu.Item
            key={language}
            leftSection={<IconLanguage size={16} />}
            rightSection={
              i18n.language === language ? (
                <IconCheck size={16} color="var(--o-primary-600)" />
              ) : undefined
            }
            onClick={() => void setLanguage(language)}
          >
            {t(`languages.${language}`)}
          </Menu.Item>
        ))}
        <Menu.Divider />
        <Menu.Item
          color="red"
          leftSection={<IconLogout size={16} className={classes.mirror} />}
          onClick={() => void signOut()}
        >
          {t('account.signOut')}
        </Menu.Item>
        <Menu.Divider />
        <Menu.Label>{t('account.version', { version: APP_VERSION })}</Menu.Label>
      </Menu.Dropdown>
    </Menu>
  );
}

/** The bell lists what is waiting (the same counts as the Today screen). */
function Bell() {
  const { t } = useTranslation();
  const { can } = useSession();
  const today = useToday();
  const d = today.data;
  const rows = d
    ? [
        ...(can('orders.view')
          ? [
              {
                to: '/orders',
                label: t('today.openOrders'),
                count: d.orders.reduce((n, o) => n + o.count, 0),
              },
            ]
          : []),
        { to: '/sales', label: t('today.heldSales'), count: d.heldSales },
        ...(can('approvals.decide')
          ? [{ to: '/approvals', label: t('today.approvals'), count: d.approvalsWaiting }]
          : []),
        { to: '/stock', label: t('today.lowStock'), count: d.lowStock },
      ].filter((r) => r.count > 0)
    : [];
  const total = d ? d.heldSales + (can('approvals.decide') ? d.approvalsWaiting : 0) : 0;
  return (
    <Menu position="bottom-end" width={288}>
      <Menu.Target>
        <UnstyledButton className={classes.bell} aria-label={t('nav.notifications')}>
          <IconBell size={18} />
          {total > 0 && <span className={classes.bellCount}>{total}</span>}
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        {rows.length === 0 && <div className={classes.bellEmpty}>{t('nav.nothingWaiting')}</div>}
        {rows.map((r) => (
          <Menu.Item
            key={r.to}
            component={Link}
            to={r.to}
            rightSection={<span className={classes.bellRowCount}>{r.count}</span>}
          >
            {r.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
