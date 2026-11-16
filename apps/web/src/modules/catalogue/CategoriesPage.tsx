import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Modal,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArchive, IconEdit, IconPlus, IconStarFilled } from '@tabler/icons-react';
import { type CSSProperties, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@web/shared/components/PageHeader';
import { ErrorState, FullScreenLoader } from '@web/shared/components/StatusScreens';
import { TranslatableInput, type Translations } from '@web/shared/components/TranslatableInput';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import { type Category, useCatalogueAdmin, useCategories, useOptionTypes } from './api';
import { useLocalized } from './components';
import classes from './catalogue.module.css';

/** Categories (a tree, with POS favourites) and the global options with their values. */
export function CategoriesPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t('catalogue.setup')} />
      <Tabs defaultValue="categories" variant="pills" keepMounted={false}>
        <Tabs.List className="ds-mb-md">
          <Tabs.Tab value="categories">{t('catalogue.categories')}</Tabs.Tab>
          <Tabs.Tab value="options">{t('catalogue.optionTypes')}</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="categories">
          <CategoriesTab />
        </Tabs.Panel>
        <Tabs.Panel value="options">
          <OptionsTab />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}

function CategoriesTab() {
  const { t } = useTranslation();
  const localized = useLocalized();
  const errorMessage = useErrorMessage();
  const query = useCategories();
  const admin = useCatalogueAdmin();
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  if (query.isPending) return <FullScreenLoader />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const all = query.data;
  const children = (parent: string | null) => all.filter((c) => c.parentId === parent);
  const fail = (e: unknown) => notifications.show({ color: 'red', message: errorMessage(e) });

  const row = (c: Category, depth: number): React.ReactNode => (
    <div key={c.id}>
      <Group
        justify="space-between"
        wrap="nowrap"
        className={classes.treeRow}
        style={{ '--depth': depth } as CSSProperties}
      >
        <Group gap={6}>
          <Text size="sm">{localized(c.name)}</Text>
          {c.isFavorite && <IconStarFilled size={12} className="ds-warning" />}
        </Group>
        <Group gap={4}>
          <ActionIcon variant="subtle" aria-label={t('common.edit')} onClick={() => setEditing(c)}>
            <IconEdit size={14} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="red"
            aria-label={t('catalogue.archive.action')}
            onClick={() =>
              admin.updateCategory.mutate({ id: c.id, body: { archived: true } }, { onError: fail })
            }
          >
            <IconArchive size={14} />
          </ActionIcon>
        </Group>
      </Group>
      {children(c.id).map((child) => row(child, depth + 1))}
    </div>
  );

  return (
    <Card withBorder className={classes.panelSm}>
      <Group justify="space-between" className="ds-mb-sm">
        <h2 className="ds-heading">{t('catalogue.categories')}</h2>
        <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setEditing('new')}>
          {t('catalogue.newCategory')}
        </Button>
      </Group>
      {all.length === 0 ? (
        <Text className="ds-muted">{t('common.empty')}</Text>
      ) : (
        children(null).map((c) => row(c, 0))
      )}
      {editing && (
        <CategoryDialog
          category={editing === 'new' ? null : editing}
          categories={all}
          onClose={() => setEditing(null)}
        />
      )}
    </Card>
  );
}

function CategoryDialog({
  category,
  categories,
  onClose,
}: {
  category: Category | null;
  categories: Category[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const localized = useLocalized();
  const errorMessage = useErrorMessage();
  const admin = useCatalogueAdmin();
  const [name, setName] = useState<Translations>(category?.name ?? {});
  const [parentId, setParentId] = useState<string | null>(category?.parentId ?? null);
  const [favorite, setFavorite] = useState(category?.isFavorite ?? false);
  const pending = admin.createCategory.isPending || admin.updateCategory.isPending;
  const save = () => {
    if (!name.ar?.trim()) return;
    const body = { name, parentId, isFavorite: favorite };
    const options = {
      onSuccess: onClose,
      onError: (e: unknown) => notifications.show({ color: 'red', message: errorMessage(e) }),
    };
    if (category) admin.updateCategory.mutate({ id: category.id, body }, options);
    else admin.createCategory.mutate(body, options);
  };
  return (
    <Modal
      opened
      onClose={onClose}
      title={category ? t('common.edit') : t('catalogue.newCategory')}
      centered
    >
      <Stack>
        <TranslatableInput label={t('catalogue.name')} value={name} onChange={setName} required />
        <Select
          label={t('catalogue.parentCategory')}
          clearable
          data={categories
            .filter((c) => c.id !== category?.id)
            .map((c) => ({ value: c.id, label: localized(c.name) }))}
          value={parentId}
          onChange={setParentId}
        />
        <Checkbox
          label={t('catalogue.favorite')}
          description={t('catalogue.favoriteHint')}
          checked={favorite}
          onChange={(e) => setFavorite(e.currentTarget.checked)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={save} loading={pending}>
            {t('common.save')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function OptionsTab() {
  const { t } = useTranslation();
  const localized = useLocalized();
  const errorMessage = useErrorMessage();
  const query = useOptionTypes();
  const admin = useCatalogueAdmin();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [newType, setNewType] = useState({ key: '', name: '' });
  const fail = (e: unknown) => notifications.show({ color: 'red', message: errorMessage(e) });
  if (query.isPending) return <FullScreenLoader />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  return (
    <Stack className="ds-w-lg">
      {query.data.map((type) => (
        <Card key={type.id} withBorder>
          <Group justify="space-between" className="ds-mb-sm">
            <h2 className="ds-heading">{localized(type.name)}</h2>
            <Badge variant="light" className="ds-ltr">
              {type.key}
            </Badge>
          </Group>
          {type.key === 'number' ? (
            <Text size="sm" className="ds-muted">
              {t('catalogue.numberTypeHint')}
            </Text>
          ) : (
            <>
              <Group gap={6} className="ds-mb-sm">
                {type.values.map((v) => (
                  <Badge
                    key={v.id}
                    variant="outline"
                    rightSection={
                      <ActionIcon
                        size="xs"
                        variant="transparent"
                        aria-label={t('catalogue.archive.action')}
                        onClick={() =>
                          admin.updateOptionValue.mutate(
                            { id: v.id, body: { archived: true } },
                            { onError: fail },
                          )
                        }
                      >
                        ×
                      </ActionIcon>
                    }
                  >
                    {localized(v.value)}
                  </Badge>
                ))}
              </Group>
              <Group gap={4} wrap="nowrap" className={classes.addValue}>
                <TextInput
                  size="xs"
                  className="ds-grow"
                  placeholder={t('catalogue.variants.newValue')}
                  value={draft[type.id] ?? ''}
                  onChange={(e) => {
                    const text = e.currentTarget.value;
                    setDraft((d) => ({ ...d, [type.id]: text }));
                  }}
                />
                <ActionIcon
                  variant="default"
                  aria-label={t('common.add')}
                  onClick={() => {
                    const text = draft[type.id]?.trim();
                    if (text)
                      admin.createOptionValue.mutate(
                        { typeId: type.id, value: { ar: text } },
                        {
                          onSuccess: () => setDraft((d) => ({ ...d, [type.id]: '' })),
                          onError: fail,
                        },
                      );
                  }}
                >
                  <IconPlus size={14} />
                </ActionIcon>
              </Group>
            </>
          )}
        </Card>
      ))}
      <Card withBorder>
        <Stack gap="sm">
          <h2 className="ds-heading">{t('catalogue.newOptionType')}</h2>
          <Group align="flex-end">
            <TextInput
              label={t('catalogue.name')}
              value={newType.name}
              onChange={(e) => {
                const text = e.currentTarget.value;
                setNewType((s) => ({ ...s, name: text }));
              }}
            />
            <TextInput
              label={t('catalogue.optionKey')}
              dir="ltr"
              value={newType.key}
              onChange={(e) => {
                const text = e.currentTarget.value;
                setNewType((s) => ({ ...s, key: text }));
              }}
            />
            <Button
              onClick={() =>
                admin.createOptionType.mutate(
                  { key: newType.key, name: { ar: newType.name } },
                  { onSuccess: () => setNewType({ key: '', name: '' }), onError: fail },
                )
              }
              disabled={!newType.key || !newType.name}
            >
              {t('common.add')}
            </Button>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}
