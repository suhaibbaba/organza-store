import { ActionIcon, Group, Menu, NavLink, Text, Title, UnstyledButton } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { Spotlight, spotlight, type SpotlightActionData } from '@mantine/spotlight';
import { LANGUAGES, type Language } from '@organza/shared';
import {
  IconChevronLeft,
  IconChevronRight,
  IconDots,
  IconLanguage,
  IconLogout,
  IconSearch,
  IconUserCircle,
} from '@tabler/icons-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink as RouterNavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { setLanguage } from '@web/i18n';
import { useSession } from '@web/modules/auth/session';
import { allItems, bottomTabs, visibleGroups } from '../navigation';
import classes from './AppLayout.module.css';

const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? 'dev';

export function AppLayout() {
  const { t, i18n } = useTranslation();
  const { user, can, signOut } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useLocalStorage({
    key: 'organza.sidebar-collapsed',
    defaultValue: false,
  });
  const groups = useMemo(() => visibleGroups(can), [can]);
  const tabs = useMemo(() => (user ? bottomTabs(user.role, can) : []), [user, can]);
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
  if (!user) return null;
  const rtl = i18n.dir() === 'rtl';
  const CollapseIcon = (collapsed ? !rtl : rtl) ? IconChevronRight : IconChevronLeft;
  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <div className={classes.shell}>
      <header className={classes.top}>
        <ActionIcon
          variant="subtle"
          visibleFrom="sm"
          onClick={() => setCollapsed((c) => !c)}
          aria-label="sidebar"
        >
          <CollapseIcon size={18} />
        </ActionIcon>
        <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
          <Title order={4}>{t('app.name')}</Title>
        </Link>
        <Group gap="xs" ms="auto">
          <ActionIcon variant="subtle" onClick={spotlight.open} aria-label={t('nav.searchScreens')}>
            <IconSearch size={18} />
          </ActionIcon>
          <Menu position="bottom-end" width={220}>
            <Menu.Target>
              <UnstyledButton aria-label="account">
                <Group gap={6}>
                  <IconUserCircle size={22} />
                  <Text size="sm" visibleFrom="xs">
                    {user.name}
                  </Text>
                </Group>
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>
                {user.name} · {t(`roles.${user.role}`)}
              </Menu.Label>
              <Menu.Divider />
              <Menu.Label>
                <Group gap={4}>
                  <IconLanguage size={14} />
                  {t('account.language')}
                </Group>
              </Menu.Label>
              {LANGUAGES.map((language: Language) => (
                <Menu.Item
                  key={language}
                  onClick={() => void setLanguage(language)}
                  fw={i18n.language === language ? 700 : 400}
                >
                  {t(`languages.${language}`)}
                </Menu.Item>
              ))}
              <Menu.Divider />
              <Menu.Item leftSection={<IconLogout size={16} />} onClick={() => void signOut()}>
                {t('account.signOut')}
              </Menu.Item>
              <Menu.Label>{t('account.version', { version: APP_VERSION })}</Menu.Label>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </header>

      <nav className={`${classes.side} ${collapsed ? classes.collapsed : ''} organza-scroll`}>
        {groups.map((group) => (
          <div key={group.key}>
            {!collapsed && <div className={classes.groupLabel}>{t(group.label)}</div>}
            {group.items.map((item) => (
              <NavLink
                key={item.key}
                component={RouterNavLink}
                to={item.path}
                end={item.path === '/'}
                label={collapsed ? undefined : t(item.label)}
                aria-label={t(item.label)}
                leftSection={<item.icon size={20} />}
                active={isActive(item.path)}
              />
            ))}
          </div>
        ))}
      </nav>

      <main className={`${classes.main} organza-scroll`}>
        <Outlet />
      </main>

      <nav className={classes.bottom}>
        {tabs.map((item) => (
          <Link
            key={item.key}
            to={item.path}
            className={`${classes.tab} ${isActive(item.path) ? classes.tabActive : ''}`}
          >
            <item.icon size={22} />
            {t(item.label)}
          </Link>
        ))}
        <UnstyledButton className={classes.tab} onClick={spotlight.open}>
          <IconDots size={22} />
          {t('nav.more')}
        </UnstyledButton>
      </nav>

      <Spotlight
        actions={actions}
        shortcut={['mod + K']}
        nothingFound={t('common.empty')}
        searchProps={{ placeholder: t('nav.searchScreens'), leftSection: <IconSearch size={18} /> }}
      />
    </div>
  );
}
