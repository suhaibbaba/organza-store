import { ActionIcon, Button, Group, Modal, Slider, Stack, Text } from '@mantine/core';
import {
  IDENTITY_IMAGE_EDIT,
  type ImageEdit,
  PRODUCT_IMAGE_ASPECT,
  rotateClockwise,
  toggleDisplayFlip,
} from '@organza/shared';
import { IconFlipHorizontal, IconFlipVertical, IconRotateClockwise } from '@tabler/icons-react';
import { type CSSProperties, type PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import classes from './catalogue.module.css';

interface Props {
  /** Object URL or server URL of the full picture, upright. */
  src: string | null;
  initial?: ImageEdit | null | undefined;
  onCancel: () => void;
  onDone: (edit: ImageEdit) => void;
}

const FRAME_W = 240;
const FRAME_H = FRAME_W / PRODUCT_IMAGE_ASPECT;

/**
 * Frames a photo in the 2:3 product shape: drag to move, slide to zoom, turn and mirror. The
 * result is fractions of the turned picture, which the server maps back onto the original.
 */
export function PhotoEditor({ src, initial, onCancel, onDone }: Props) {
  const { t } = useTranslation();
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [rotation, setRotation] = useState<ImageEdit['rotation']>(initial?.rotation ?? 0);
  const [flip, setFlip] = useState({
    h: initial?.flipHorizontal ?? false,
    v: initial?.flipVertical ?? false,
  });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    setOffset({ x: 0, y: 0 });
    setZoom(1);
  }, [rotation]);

  // Size of the turned picture, scaled so it covers the frame at zoom 1.
  const view = useMemo(() => {
    if (!natural) return null;
    const turned = rotation === 90 || rotation === 270;
    const w = turned ? natural.h : natural.w;
    const h = turned ? natural.w : natural.h;
    const scale = Math.max(FRAME_W / w, FRAME_H / h) * zoom;
    return { w: w * scale, h: h * scale, turned };
  }, [natural, rotation, zoom]);

  const clampOffset = (x: number, y: number) => {
    if (!view) return { x, y };
    const maxX = (view.w - FRAME_W) / 2;
    const maxY = (view.h - FRAME_H) / 2;
    return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
  };

  const onPointerDown = (e: PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!drag.current) return;
    setOffset(
      clampOffset(
        drag.current.ox + e.clientX - drag.current.x,
        drag.current.oy + e.clientY - drag.current.y,
      ),
    );
  };

  const finish = () => {
    if (!view) return onDone(IDENTITY_IMAGE_EDIT);
    const c = clampOffset(offset.x, offset.y);
    const left = (view.w - FRAME_W) / 2 - c.x;
    const top = (view.h - FRAME_H) / 2 - c.y;
    onDone({
      rotation,
      flipHorizontal: flip.h,
      flipVertical: flip.v,
      crop: {
        x: left / view.w,
        y: top / view.h,
        width: FRAME_W / view.w,
        height: FRAME_H / view.h,
      },
    });
  };

  // The picture element is drawn unturned and turned with CSS, centred in the frame.
  const imgW = view ? (view.turned ? view.h : view.w) : 0;
  const imgH = view ? (view.turned ? view.w : view.h) : 0;
  const c = clampOffset(offset.x, offset.y);
  const transform = `translate(-50%, -50%) translate(${c.x}px, ${c.y}px) rotate(${rotation}deg) scale(${flip.h ? -1 : 1}, ${flip.v ? -1 : 1})`;

  return (
    <Modal
      opened={Boolean(src)}
      onClose={onCancel}
      title={t('catalogue.photo.edit')}
      centered
      size="auto"
    >
      <Stack
        align="center"
        style={{ '--frame-w': `${FRAME_W}px`, '--frame-h': `${FRAME_H}px` } as CSSProperties}
      >
        <div
          className={classes.editorFrame}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => (drag.current = null)}
        >
          {src && (
            <img
              src={src}
              alt=""
              draggable={false}
              onLoad={(e) =>
                setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
              }
              className={classes.editorImage}
              style={
                {
                  '--img-w': imgW ? `${imgW}px` : 'auto',
                  '--img-h': imgH ? `${imgH}px` : 'auto',
                  '--transform': transform,
                } as CSSProperties
              }
            />
          )}
        </div>
        <Stack gap={4} className={classes.editorControls}>
          <Text size="xs" className="ds-muted">
            {t('catalogue.photo.zoom')}
          </Text>
          <Slider min={1} max={4} step={0.05} value={zoom} onChange={setZoom} label={null} />
        </Stack>
        <Group>
          <ActionIcon
            variant="default"
            size="lg"
            aria-label={t('catalogue.photo.rotate')}
            onClick={() => setRotation(rotateClockwise(rotation))}
          >
            <IconRotateClockwise size={18} />
          </ActionIcon>
          <ActionIcon
            variant="default"
            size="lg"
            aria-label={t('catalogue.photo.flipH')}
            onClick={() => {
              const next = toggleDisplayFlip(
                { ...IDENTITY_IMAGE_EDIT, rotation, flipHorizontal: flip.h, flipVertical: flip.v },
                'horizontal',
              );
              setFlip({ h: next.flipHorizontal, v: next.flipVertical });
            }}
          >
            <IconFlipVertical size={18} />
          </ActionIcon>
          <ActionIcon
            variant="default"
            size="lg"
            aria-label={t('catalogue.photo.flipV')}
            onClick={() => {
              const next = toggleDisplayFlip(
                { ...IDENTITY_IMAGE_EDIT, rotation, flipHorizontal: flip.h, flipVertical: flip.v },
                'vertical',
              );
              setFlip({ h: next.flipHorizontal, v: next.flipVertical });
            }}
          >
            <IconFlipHorizontal size={18} />
          </ActionIcon>
        </Group>
        <Group justify="flex-end" className="ds-full">
          <Button variant="default" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button onClick={finish}>{t('common.save')}</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
