import { ActionIcon, FileButton, Image, Loader, Button } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { ImageEdit, ImageView } from '@organza/shared';
import { IconCrop, IconPhotoPlus, IconStar, IconStarFilled, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '@web/modules/auth/session';
import { AskApprovalDialog } from '@web/modules/sales/AskApprovalDialog';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import { useImageMutations } from './api';
import { PhotoEditor } from './PhotoEditor';
import classes from './catalogue.module.css';

/** Photos of a saved product: add, re-frame from the kept original, make main, remove. */
export function ProductImages({ productId, images }: { productId: string; images: ImageView[] }) {
  const { t } = useTranslation();
  const { can } = useSession();
  const errorMessage = useErrorMessage();
  const m = useImageMutations(productId);
  const [askingDelete, setAskingDelete] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ src: string; file?: File; imageId?: string } | null>(
    null,
  );
  const fail = (e: unknown) => notifications.show({ color: 'red', message: errorMessage(e) });

  const done = (edit: ImageEdit) => {
    const target = editing;
    setEditing(null);
    if (!target) return;
    if (target.file) m.upload.mutate({ file: target.file, edit }, { onError: fail });
    else if (target.imageId) m.recrop.mutate({ id: target.imageId, edit }, { onError: fail });
  };
  const busy = m.upload.isPending || m.recrop.isPending;

  return (
    <div className={classes.imageStrip}>
      {images.map((img) => (
        <div key={img.id} className={classes.imageTile}>
          <Image src={img.thumbnailUrl} w={96} h={144} radius="sm" fit="cover" alt="" />
          {can('products.edit') && (
            <div className={classes.imageTileActions}>
              <ActionIcon
                size="sm"
                variant="white"
                aria-label={t('catalogue.photo.makeMain')}
                onClick={() =>
                  m.reorder.mutate(
                    [img.id, ...images.filter((i) => i.id !== img.id).map((i) => i.id)],
                    { onError: fail },
                  )
                }
              >
                {img.isPrimary ? <IconStarFilled size={12} /> : <IconStar size={12} />}
              </ActionIcon>
              {img.originalUrl && (
                <ActionIcon
                  size="sm"
                  variant="white"
                  aria-label={t('catalogue.photo.edit')}
                  onClick={() => setEditing({ src: img.originalUrl!, imageId: img.id })}
                >
                  <IconCrop size={12} />
                </ActionIcon>
              )}
              {(can('images.delete') || can('images.upload')) && (
                <ActionIcon
                  size="sm"
                  variant="white"
                  color="red"
                  aria-label={t('common.remove')}
                  onClick={() =>
                    can('images.delete')
                      ? m.remove.mutate(img.id, { onError: fail })
                      : setAskingDelete(img.id)
                  }
                >
                  <IconTrash size={12} />
                </ActionIcon>
              )}
            </div>
          )}
        </div>
      ))}
      {can('images.upload') && (
        <FileButton
          accept="image/jpeg,image/png,image/webp"
          onChange={(file) => file && setEditing({ src: URL.createObjectURL(file), file })}
        >
          {(props) => (
            <Button
              {...props}
              variant="default"
              h={144}
              w={96}
              p={0}
              disabled={busy}
              aria-label={t('catalogue.photo.add')}
            >
              {busy ? <Loader size="sm" /> : <IconPhotoPlus size={24} />}
            </Button>
          )}
        </FileButton>
      )}
      <PhotoEditor src={editing?.src ?? null} onCancel={() => setEditing(null)} onDone={done} />
      <AskApprovalDialog
        opened={Boolean(askingDelete)}
        title={t('approvals.kind.IMAGE_DELETE')}
        request={{ kind: 'IMAGE_DELETE', imageId: askingDelete ?? '' }}
        onClose={() => setAskingDelete(null)}
      />
    </div>
  );
}
