import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/components/providers/session-provider";
import { usePasskeySupport } from "@/hooks/use-passkey-support";
import { cancelPasskeyPrompt, PasskeyError, passkeyAutofillSupported } from "@/lib/auth/passkey";
import { PASSKEY_ERROR_MESSAGE_KEYS } from "@/constants/auth";
import type { PasskeySignInHandlers } from "@/types/auth";

function failureMessageKey(error: unknown): string | null {
  const failure = error instanceof PasskeyError ? error.failure : "failed";
  return failure === "cancelled" ? null : PASSKEY_ERROR_MESSAGE_KEYS[failure];
}

// Two ways in: the passkey offered in the email field's suggestions (waiting quietly), and the button beside Sign in.
export function usePasskeySignIn(handlers: PasskeySignInHandlers) {
  const { loginWithPasskey } = useSession();
  const available = usePasskeySupport();
  const [pending, setPending] = useState(false);
  // Bumped after a failed or closed attempt so the suggestions are offered again.
  const [round, setRound] = useState(0);
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!(await passkeyAutofillSupported()) || !active) {
        return;
      }
      try {
        const user = await loginWithPasskey(true);
        if (active) {
          handlersRef.current.onSignedIn(user);
        }
      } catch (error) {
        const messageKey = failureMessageKey(error);
        // A closed ceremony here means the button took over; that attempt restarts the suggestions itself.
        if (active && messageKey) {
          handlersRef.current.onMessage(messageKey);
          setRound((value) => value + 1);
        }
      }
    })();
    return () => {
      active = false;
      cancelPasskeyPrompt();
    };
  }, [round, loginWithPasskey]);

  const signIn = useCallback(async () => {
    handlersRef.current.onMessage(null);
    setPending(true);
    try {
      handlersRef.current.onSignedIn(await loginWithPasskey());
    } catch (error) {
      handlersRef.current.onMessage(failureMessageKey(error));
      setRound((value) => value + 1);
    } finally {
      setPending(false);
    }
  }, [loginWithPasskey]);

  return { available, pending, signIn };
}
