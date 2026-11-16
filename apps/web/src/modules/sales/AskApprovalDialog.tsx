import { Alert, Button, Group, Modal, Stack, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { ApprovalRequestInput } from '@organza/shared';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import { useApprovalActions } from './api';

type WithoutReason<T> = T extends unknown ? Omit<T, 'reason'> : never;

/**
 * Sends an action the signed-in person may not do alone to the approvals inbox, with the
 * reason a manager will read. `request` is the action exactly as it would have been done.
 */
export function AskApprovalDialog({
  opened,
  title,
  children,
  request,
  onClose,
  onSent,
}: {
  opened: boolean;
  title: string;
  children?: ReactNode;
  request: WithoutReason<ApprovalRequestInput>;
  onClose: () => void;
  onSent?: () => void;
}) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const { request: send } = useApprovalActions();
  const [reason, setReason] = useState('');
  const submit = async () => {
    try {
      await send.mutateAsync({ ...request, reason: reason.trim() } as ApprovalRequestInput);
      notifications.show({ color: 'green', message: t('approvals.sent') });
      setReason('');
      onSent?.();
      onClose();
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    }
  };
  return (
    <Modal opened={opened} onClose={onClose} title={title} centered>
      <Stack>
        <Alert color="blue" variant="light">
          {t('approvals.needsManager')}
        </Alert>
        {children}
        <Textarea
          label={t('approvals.reasonForManager')}
          required
          data-autofocus
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t('common.back')}
          </Button>
          <Button
            loading={send.isPending}
            disabled={reason.trim().length < 3}
            onClick={() => void submit()}
          >
            {t('approvals.ask')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
