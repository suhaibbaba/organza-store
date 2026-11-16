import { ActionIcon, Button, FileButton, Image, Loader, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { ImageEdit, ImageView } from '@organza/shared';
import { IconPhotoPlus, IconStar, IconStarFilled, IconX } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import { uploadImage } from './api';
import { PhotoEditor } from './PhotoEditor';
import classes from './catalogue.module.css';

interface Props {
  value: ImageView[];
  onChange: (images: ImageView[]) => void;
  label?: string;
  max?: number;
}

/**
 * Photos for a product not saved yet: each is uploaded as soon as it is framed, and the product
 * form sends their ids. The first photo is the main one.
 */
export function PhotosField({ value, onChange, label, max = 20 }: Props) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const [pending, setPending] = useState<{ file: File; url: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(
    () => () => {
      if (pending) URL.revokeObjectURL(pending.url);
    },
    [pending],
  );

  const save = async (edit: ImageEdit) => {
    if (!pending) return;
    const file = pending.file;
    setPending(null);
    setBusy(true);
    try {
      const image = await uploadImage(file, { edit });
      onChange([...value, image]);
    } catch (error) {
      notifications.show({ color: 'red', message: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack gap={6}>
      <Text size="sm" fw={500}>
        {label ?? t('catalogue.photos')}
      </Text>
      <div className={classes.imageStrip}>
        {value.map((img, i) => (
          <div key={img.id} className={classes.imageTile}>
            <Image src={img.thumbnailUrl} w={72} h={108} radius="sm" fit="cover" alt="" />
            <div className={classes.imageTileActions}>
              <ActionIcon
                size="sm"
                variant="white"
                aria-label={t('catalogue.photo.makeMain')}
                onClick={() => onChange([img, ...value.filter((v) => v.id !== img.id)])}
              >
                {i === 0 ? <IconStarFilled size={12} /> : <IconStar size={12} />}
              </ActionIcon>
              <ActionIcon
                size="sm"
                variant="white"
                color="red"
                aria-label={t('common.remove')}
                onClick={() => onChange(value.filter((v) => v.id !== img.id))}
              >
                <IconX size={12} />
              </ActionIcon>
            </div>
          </div>
        ))}
        {value.length < max && (
          <FileButton
            accept="image/jpeg,image/png,image/webp"
            onChange={(file) => file && setPending({ file, url: URL.createObjectURL(file) })}
          >
            {(props) => (
              <Button
                {...props}
                variant="default"
                h={108}
                w={72}
                p={0}
                disabled={busy}
                aria-label={t('catalogue.photo.add')}
              >
                {busy ? <Loader size="sm" /> : <IconPhotoPlus size={22} />}
              </Button>
            )}
          </FileButton>
        )}
      </div>
      <PhotoEditor
        src={pending?.url ?? null}
        onCancel={() => setPending(null)}
        onDone={(edit) => void save(edit)}
      />
    </Stack>
  );
}
