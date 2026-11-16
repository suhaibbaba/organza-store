// WHOEVER IS SIGNED IN CAN SEE WHO THEY ARE, AND CAN LEAVE.
//
// This is the bug this suite was written for: the account lived in the header
// only from `md` up, and on a phone the only place a name appeared at all was
// the dashboard's "welcome back" — a page an Employee is not allowed to open.
// So the person who spends the whole day taking orders was the one person who
// could never tell which account those orders were being filed under.
//
// The rule the tests below hold the shell to is therefore about ROLES, not
// about a component: every signed-in role, on a phone, sees their own name in
// the shell and can sign out from it — with no page involved, because a page
// is exactly what an Employee may not have.
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { Role } from "@organza/shared/types/role";
import messages from "@/messages/ar.json";
import type { SessionUser } from "@/types/auth";

// Changing the language navigates — next-intl's `router.replace(pathname,
// { locale })` is what both moves the page and writes the cookie that
// remembers the choice (i18n/routing.ts). There is no Next router here, so it
// is a spy, and the language test below asserts on what it was asked to do.
const replace = vi.hoisted(() => vi.fn());

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children }: { children: ReactNode }) => children,
  usePathname: () => "/orders",
  useRouter: () => ({ replace, push: vi.fn() }),
  redirect: vi.fn(),
}));

// The session itself is the one thing that IS mocked: signing in for real
// needs a server. Everything downstream of it — the naming rule, the header,
// the menu — is the app's own code, running.
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
    // Arabic, because Arabic is the default the shop actually runs in
    // (CLAUDE.md rule 9) — and because a name rendered through t() has to
    // come out of the real message file, not a stub.
    <NextIntlClientProvider locale="ar" messages={messages}>
      <QueryClientProvider client={queryClient}>
        <TopBar />
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}

/** The three seeded roles, each with the identity its account really carries. */
const ACCOUNTS: { role: Role; user: SessionUser; expectedName: string }[] = [
  {
    role: "ADMIN",
    user: { id: "usr_1", name: "سهيب بابا", email: "admin@organza.test", role: "ADMIN", isActive: true },
    // Their own name, as stored.
    expectedName: "سهيب بابا",
  },
  {
    role: "MANAGER",
    // No name on the account — which is the ordinary state of a staff account
    // created from a roster of addresses.
    user: { id: "usr_2", name: "", email: "manager@organza.test", role: "MANAGER", isActive: true },
    expectedName: "manager",
  },
  {
    role: "EMPLOYEE",
    // A stored name that is really an internal id. This is not hypothetical:
    // an API test renamed the sandbox's own account and never put it back, and
    // "Admin mt0grbxoqx7nbf" showed in the POS header for weeks.
    user: { id: "usr_3", name: "mt0grbxoqx7nbf", email: "employee@organza.test", role: "EMPLOYEE", isActive: true },
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
      // The word the shop reads, from the real Arabic message file — not a
      // key, and not English.
      await userEvent.click(within(menu).getByText(messages.common.logout));

      expect(logout).toHaveBeenCalledTimes(1);
    });

    it(`tells a ${role} which account they are working under`, async () => {
      signedInAs(user);
      renderShellHeader();

      await userEvent.click(screen.getByTestId("account-menu"));
      const menu = await screen.findByRole("menu");

      // Their role, in words, because the app looks different for each one —
      // and their address, which is what an Admin needs when somebody says
      // "it will not let me".
      expect(menu).toHaveTextContent(messages.users.role[role]);
      expect(menu).toHaveTextContent(user.email);
    });
  }

  it("keeps the account on screen at phone width, where the bug was", () => {
    signedInAs(ACCOUNTS[2].user);
    renderShellHeader();

    // jsdom has no layout and no compiled Tailwind, so "is it visible on a
    // phone" cannot be measured here — but it can still be READ. The account
    // was hidden by `hidden md:flex`, and Tailwind's `hidden` is display:none
    // at every width unless a breakpoint puts it back: the class has to be
    // present for the element to be hidden below one. So an ancestor carrying
    // it is the bug itself, in the only form this environment can see.
    let node: HTMLElement | null = screen.getByTestId("account-menu");
    while (node) {
      expect(node.classList.contains("hidden")).toBe(false);
      node = node.parentElement;
    }
  });

  it("does not depend on the signed-in person's own name existing at all", () => {
    // No name, no address: everything an account can be missing. The role is
    // the last thing that is still true about them, and it is what shows.
    signedInAs({ id: "usr_4", name: "", email: "", role: "EMPLOYEE", isActive: true });
    renderShellHeader();

    expect(screen.getByTestId("account-menu")).toHaveTextContent(messages.users.role.EMPLOYEE);
    expect(screen.getByTestId("account-menu")).not.toHaveTextContent("usr_4");
  });
});


// THE HEADER HOLDS THREE THINGS, AND THE LANGUAGE IS NOT ONE OF THEM.
//
// It was: the shop's name, the sandbox chip, the language and the account all
// shared one row, and the language was the one that gave way — its label
// dropped below `sm` and it became an unlabelled icon on exactly the devices
// 95% of the shop uses. It lives in the account menu now, beside sign-out,
// which is a person's own settings rather than a fourth thing in a bar.
//
// What these hold is the BARGAIN of that move: nothing became harder to
// reach. Two taps, still, and which language is on is answered by looking.
describe("The language lives in the account menu", () => {
  const LOCALES = [
    { locale: "ar", label: "العربية" },
    { locale: "en", label: "English" },
    { locale: "he", label: "עברית" },
  ] as const;

  it("is not a control of its own in the header", () => {
    signedInAs(ACCOUNTS[0].user);
    renderShellHeader();

    // The header is the shop, the chip and the account. Anything else in it
    // is the crowding this change removed.
    expect(screen.queryByTestId("language-switcher")).not.toBeInTheDocument();
    for (const { locale } of LOCALES) {
      expect(screen.queryByTestId(`language-option-${locale}`)).not.toBeInTheDocument();
    }
  });

  it("offers every language the shop runs in, one tap after the menu opens", async () => {
    signedInAs(ACCOUNTS[0].user);
    renderShellHeader();

    // Tap one.
    await userEvent.click(screen.getByTestId("account-menu"));
    const menu = await screen.findByRole("menu");

    // Under a heading that says what they are — not three unexplained words
    // in the middle of somebody's account.
    expect(menu).toHaveTextContent(messages.common.language);
    for (const { locale, label } of LOCALES) {
      // Each language written in its own script, so it is legible to whoever
      // wants it even when the interface is not in a language they read.
      expect(within(menu).getByTestId(`language-option-${locale}`)).toHaveTextContent(label);
    }
  });

  it("says which language is on without opening anything further", async () => {
    signedInAs(ACCOUNTS[0].user);
    renderShellHeader();

    await userEvent.click(screen.getByTestId("account-menu"));
    const menu = await screen.findByRole("menu");

    // Rendered in Arabic, so Arabic is the one checked — and it is the ONLY
    // one, or "which is on" would be no clearer than before.
    const checked = within(menu).getAllByRole("menuitemradio", { checked: true });
    expect(checked).toHaveLength(1);
    expect(checked[0]).toHaveTextContent("العربية");
  });

  it("switches in two taps, and remembers the choice by navigating", async () => {
    signedInAs(ACCOUNTS[0].user);
    renderShellHeader();

    await userEvent.click(screen.getByTestId("account-menu"));
    const menu = await screen.findByRole("menu");
    await userEvent.click(within(menu).getByTestId("language-option-en"));

    // The same screen in the other language. `replace` rather than `push` so
    // the language switch does not become a step in the back history, and
    // next-intl writes the year-long locale cookie as it goes — which is what
    // makes the choice survive the app being closed.
    expect(replace).toHaveBeenCalledWith("/orders", { locale: "en" });
  });

  it("is reachable for every role, since every role has the account menu", async () => {
    for (const { role, user } of ACCOUNTS) {
      signedInAs(user);
      const view = renderShellHeader();

      await userEvent.click(screen.getAllByTestId("account-menu")[0]);
      const menu = await screen.findByRole("menu");
      expect(within(menu).getByTestId("language-option-en"), `${role} can reach the language`).toBeInTheDocument();

      view.unmount();
    }
  });
});
