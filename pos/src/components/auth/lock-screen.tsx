"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Avatar,
  Button,
  CardButton,
  FormField,
  PasscodeInput,
  Skeleton,
  Spinner,
  Typography,
  buttonClassName,
} from "@store/ui";
import { PASSCODE_LENGTH } from "@store/shared/constants/posLock";
import { ERROR_CODES } from "@store/shared/constants/errors";
import { testSelectorFor } from "@store/shared/lib/testSelector";
import type { PosDeviceMemberSummary } from "@store/shared/types/posDevice";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { ShopLogo } from "@/components/brand/shop-logo";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { useSession } from "@/components/providers/session-provider";
import { fetchDeviceMembers } from "@/lib/api/pos-device";
import { getDeviceCredentials } from "@/lib/auth/device-storage";
import { ApiError } from "@/lib/api/errors";
import { errorMessageKey } from "@/hooks/use-translate-error";
import { POS_MEMBERS_QUERY_KEY } from "@/constants/api";
import { LOGIN_HREF } from "@/constants/auth";
import { WindowControls } from "@/components/layout/window-controls";

const FIELD_ID = "pos-unlock-passcode";

// The till after it locks: pick yourself, type your passcode; the server checks it and opens a fresh session.
export function LockScreen() {
  const t = useTranslations("lock");
  const tRole = useTranslations("common.role");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { unlock } = useSession();
  const [selected, setSelected] = useState<PosDeviceMemberSummary | null>(null);
  const [passcode, setPasscode] = useState("");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [lockedOut, setLockedOut] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const members = useQuery({
    queryKey: POS_MEMBERS_QUERY_KEY,
    queryFn: () => {
      const credentials = getDeviceCredentials();
      return credentials ? fetchDeviceMembers(credentials) : Promise.resolve([]);
    },
    retry: false,
  });

  // Nobody can unlock here (everyone signed out, or the tablet was forgotten): the email sign-in is the only way in.
  useEffect(() => {
    const unknownDevice = members.error instanceof ApiError && members.error.code === ERROR_CODES.POS_DEVICE_UNKNOWN;
    if ((members.isSuccess && members.data.length === 0) || unknownDevice) {
      router.replace(LOGIN_HREF);
    }
  }, [members.isSuccess, members.data, members.error, router]);

  // The box is disabled while the server checks, which drops focus; a wrong code puts it straight back.
  useEffect(() => {
    if (!isUnlocking && errorKey) {
      inputRef.current?.focus();
    }
  }, [isUnlocking, errorKey]);

  // A single person on the tablet is picked already: one less tap at the counter.
  const person = selected ?? (members.data?.length === 1 ? (members.data[0] ?? null) : null);
  const isLockedOut = lockedOut || Boolean(person?.locked);

  function choose(member: PosDeviceMemberSummary | null) {
    setSelected(member);
    setPasscode("");
    setErrorKey(null);
    setLockedOut(false);
  }

  async function handleComplete(entered: string) {
    if (!person) {
      return;
    }
    setIsUnlocking(true);
    setErrorKey(null);
    try {
      const user = await unlock(person.userId, entered);
      // The person's own language, as after a password sign-in.
      if (user?.locale && user.locale !== locale) {
        router.replace(pathname, { locale: user.locale });
      }
    } catch (error) {
      const code = error instanceof ApiError ? error.code : ERROR_CODES.INTERNAL;
      setPasscode("");
      if (code === ERROR_CODES.POS_PASSCODE_LOCKED) {
        setLockedOut(true);
      } else {
        setErrorKey(errorMessageKey(code));
      }
    } finally {
      setIsUnlocking(false);
    }
  }

  return (
    <main
      className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas px-4 py-8"
      data-test-selector="pos-lock-screen"
    >
      <WindowControls floating />
      <div className="flex w-full max-w-lg flex-col gap-5 rounded-card border border-line bg-surface p-6 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <ShopLogo className="h-12 w-auto" />
          <LanguageSwitcher variant="pill" />
        </div>

        {!person ? (
          <>
            <div className="flex flex-col gap-1">
              <Typography variant="h1">{t("title")}</Typography>
              <Typography variant="body" tone="muted">
                {t("description")}
              </Typography>
            </div>
            {members.isLoading ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Skeleton className="h-16 rounded-panel" />
                <Skeleton className="h-16 rounded-panel" />
              </div>
            ) : members.isError ? (
              <Alert
                tone="danger"
                action={
                  <Button variant="secondary" onClick={() => void members.refetch()}>
                    {t("retry")}
                  </Button>
                }
              >
                {t("loadFailed")}
              </Alert>
            ) : (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" data-test-selector="pos-lock-people">
                {members.data?.map((member) => (
                  <li key={member.userId}>
                    <CardButton
                      onClick={() => choose(member)}
                      data-testid={testSelectorFor("pos-lock-person", member.userId)}
                      className="items-center gap-3 p-3"
                    >
                      <Avatar name={member.name} tintKey={member.userId} size={40} />
                      <span className="flex min-w-0 flex-col">
                        <Typography as="span" variant="body" weight="semibold" className="truncate">
                          {member.name}
                        </Typography>
                        <Typography as="span" variant="caption" tone="muted">
                          {tRole(member.role)}
                        </Typography>
                      </span>
                    </CardButton>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-4" data-test-selector="pos-lock-passcode">
            <div className="flex items-center gap-3">
              <Avatar name={person.name} tintKey={person.userId} size={48} />
              <div className="flex min-w-0 flex-col">
                <Typography variant="h2" className="truncate">
                  {person.name}
                </Typography>
                <Typography variant="caption" tone="muted">
                  {tRole(person.role)}
                </Typography>
              </div>
            </div>

            {isLockedOut ? (
              <Alert tone="warning" data-testid="pos-lock-locked-out">
                {t("lockedOut")}
              </Alert>
            ) : (
              <FormField
                label="lock.passcode"
                htmlFor={FIELD_ID}
                error={errorKey ? { type: "manual", message: errorKey } : undefined}
                errorKey={errorKey ?? undefined}
              >
                <div className="flex items-center gap-3">
                  <PasscodeInput
                    ref={inputRef}
                    id={FIELD_ID}
                    value={passcode}
                    onChange={setPasscode}
                    onComplete={(entered) => void handleComplete(entered)}
                    length={PASSCODE_LENGTH}
                    label={t("passcode")}
                    hasError={errorKey !== null}
                    disabled={isUnlocking}
                    autoFocus
                    data-testid="pos-lock-passcode-input"
                  />
                  {isUnlocking && <Spinner label={t("unlocking")} />}
                </div>
              </FormField>
            )}

            {(members.data?.length ?? 0) > 1 && (
              <Button
                variant="secondary"
                onClick={() => choose(null)}
                data-testid="pos-lock-change-person"
                className="self-start"
              >
                {t("changePerson")}
              </Button>
            )}
          </div>
        )}

        <Link
          href={LOGIN_HREF}
          className={buttonClassName({ variant: "quiet", className: "self-start" })}
          data-test-selector="pos-lock-use-password"
        >
          {t("usePassword")}
        </Link>
      </div>
    </main>
  );
}
