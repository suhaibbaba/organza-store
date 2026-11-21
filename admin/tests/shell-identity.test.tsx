// Every role, on a phone, sees their own name in the shell and can sign out, with no page involved.
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { Role } from "@store/shared/types/role";
import messages from "@/messages/ar.json";
import type { SessionUser } from "@/types/auth";

// router.replace both navigates and writes the locale cookie; spied, since there is no Next router.
const replace = vi.hoisted(() => vi.fn());

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children }: { children: ReactNode }) => children,
  usePathname: () => "/orders",
  useRouter: () => ({ replace, push: vi.fn() }),
  redirect: vi.fn(),
}));

// Only the session is mocked; everything downstream is the app's own code.
const logout = vi.fn();
const session = vi.hoisted(() => ({ user: null as SessionUser | null }));

vi.mock("@/components/providers/session-provider", () => ({
  useSession: () => ({
    user: session.user,
    isLoading: false,
    isError: false,
    refresh: vi.fn(),
    login: vi.fn(),
    logout,
  }),
}));

const { TopBar } = await import("@/components/layout/top-bar");

function signedInAs(user: SessionUser | null) {
  session.user = user;
}

function renderShellHeader() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    // Arabic, the default (rule 9), from the real message file.
    <NextIntlClientProvider locale="ar" messages={messages}>
      <QueryClientProvider client={queryClient}>
        <TopBar />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

/** The three seeded roles, each with the identity its account really carries. */
const ACCOUNTS: { role: Role; user: SessionUser; expectedName: string }[] = [
  {
    role: "ADMIN",
    user: { id: "usr_1", name: "سهيب بابا", email: "admin@store.test", role: "ADMIN", isActive: true },
    // Their own name, as stored.
    expectedName: "سهيب بابا",
  },
  {
    role: "MANAGER",
    // No name: the ordinary state of an account created from a roster of addresses.
    user: { id: "usr_2", name: "", email: "manager@store.test", role: "MANAGER", isActive: true },
    expectedName: "manager",
  },
  {
    role: "EMPLOYEE",
    // A stored name that is really an internal id (it once showed in the POS header for weeks).
    user: { id: "usr_3", name: "mt0grbxoqx7nbf", email: "employee@store.test", role: "EMPLOYEE", isActive: true },
    expectedName: "employee",
  },
];

describe("The app shell names whoever is signed in", () => {
  for (const { role, user, expectedName } of ACCOUNTS) {
    it(`shows a ${role} their own name in the header`, () => {
      signedInAs(user);
      renderShellHeader();

      const account = screen.getByTestId("account-menu");
      expect(account).toHaveTextContent(expectedName);
      // Never the id — not the account's id, and not an id-shaped name.
      expect(account).not.toHaveTextContent(user.id);
      expect(account).not.toHaveTextContent("mt0grbxoqx7nbf");
    });

    it(`lets a ${role} sign out from the header`, async () => {
      signedInAs(user);
      renderShellHeader();

      await userEvent.click(screen.getByTestId("account-menu"));
      const menu = await screen.findByRole("menu");
      await userEvent.click(within(menu).getByText(messages.common.logout));

      expect(logout).toHaveBeenCalledTimes(1);
    });

    it(`tells a ${role} which account they are working under`, async () => {
      signedInAs(user);
      renderShellHeader();

      await userEvent.click(screen.getByTestId("account-menu"));
      const menu = await screen.findByRole("menu");

      // Role in words, and the address an Admin needs when someone says "it won't let me".
      expect(menu).toHaveTextContent(messages.users.role[role]);
      expect(menu).toHaveTextContent(user.email);
    });
  }

  it("keeps the account on screen at phone width, where the bug was", () => {
    signedInAs(ACCOUNTS[2].user);
    renderShellHeader();

    // jsdom has no layout, so an ancestor with `hidden` (display:none below md) is the bug in the form visible here.
    let node: HTMLElement | null = screen.getByTestId("account-menu");
    while (node) {
      expect(node.classList.contains("hidden")).toBe(false);
      node = node.parentElement;
    }
  });

  it("does not depend on the signed-in person's own name existing at all", () => {
    // Nothing but the role is left, so the role shows.
    signedInAs({ id: "usr_4", name: "", email: "", role: "EMPLOYEE", isActive: true });
    renderShellHeader();

    expect(screen.getByTestId("account-menu")).toHaveTextContent(messages.users.role.EMPLOYEE);
    expect(screen.getByTestId("account-menu")).not.toHaveTextContent("usr_4");
  });
});

// The language is its own pill in the header, beside the account, for every role.
describe("The language is a pill beside the account", () => {
  const LOCALES = [
    { locale: "ar", label: "العربية" },
    { locale: "en", label: "English" },
    { locale: "he", label: "עברית" },
  ] as const;

  it("is not inside the account menu", async () => {
    signedInAs(ACCOUNTS[0].user);
    renderShellHeader();

    await userEvent.click(screen.getByTestId("account-menu"));
    const menu = await screen.findByRole("menu");
    for (const { locale } of LOCALES) {
      expect(within(menu).queryByTestId(`language-option-${locale}`)).not.toBeInTheDocument();
    }
  });

  it("offers every language the shop runs in, one tap after the menu opens", async () => {
    signedInAs(ACCOUNTS[0].user);
    renderShellHeader();

    await userEvent.click(screen.getByTestId("language-switcher"));
    const menu = await screen.findByRole("menu");

    expect(menu).toHaveTextContent(messages.common.language);
    for (const { locale, label } of LOCALES) {
      // Each language in its own script, legible whatever the interface language.
      expect(within(menu).getByTestId(`language-option-${locale}`)).toHaveTextContent(label);
    }
  });

  it("says which language is on without opening anything further", async () => {
    signedInAs(ACCOUNTS[0].user);
    renderShellHeader();

    await userEvent.click(screen.getByTestId("language-switcher"));
    const menu = await screen.findByRole("menu");

    // Rendered in Arabic, so Arabic is the one (and only) checked.
    const checked = within(menu).getAllByRole("menuitemradio", { checked: true });
    expect(checked).toHaveLength(1);
    expect(checked[0]).toHaveTextContent("العربية");
  });

  it("switches in two taps, and remembers the choice by navigating", async () => {
    signedInAs(ACCOUNTS[0].user);
    renderShellHeader();

    await userEvent.click(screen.getByTestId("language-switcher"));
    const menu = await screen.findByRole("menu");
    await userEvent.click(within(menu).getByTestId("language-option-en"));

    // `replace` keeps it out of the back history; next-intl's cookie makes it survive a relaunch.
    expect(replace).toHaveBeenCalledWith("/orders", { locale: "en" });
  });

  it("is reachable for every role", async () => {
    for (const { role, user } of ACCOUNTS) {
      signedInAs(user);
      const view = renderShellHeader();

      await userEvent.click(screen.getAllByTestId("language-switcher")[0]);
      const menu = await screen.findByRole("menu");
      expect(within(menu).getByTestId("language-option-en"), `${role} can reach the language`).toBeInTheDocument();

      view.unmount();
    }
  });
});
