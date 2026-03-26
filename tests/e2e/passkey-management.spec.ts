import path from "node:path";

import { expect, test, type BrowserContext, type Page } from "@playwright/test";

type VirtualAuthenticator = {
  getCredentialCount: () => Promise<number>;
  dispose: () => Promise<void>;
};

const simpleWebAuthnBundlePath = path.join(
  process.cwd(),
  "node_modules/@simplewebauthn/browser/dist/bundle/index.umd.min.js",
);

async function installVirtualAuthenticator(context: BrowserContext, page: Page): Promise<VirtualAuthenticator> {
  const client = await context.newCDPSession(page);

  await client.send("WebAuthn.enable");

  const { authenticatorId } = await client.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });

  return {
    async getCredentialCount() {
      const { credentials } = await client.send("WebAuthn.getCredentials", {
        authenticatorId,
      });

      return credentials.length;
    },
    async dispose() {
      await client.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId });
    },
  };
}

async function openWorkspaceManager(page: Page) {
  await page.getByRole("button", { name: "Arbeitsbereich & Konto" }).click();
  await expect(page.getByRole("heading", { name: "Passkeys hinzufügen" })).toBeVisible();
}

async function browserPost<T>(page: Page, baseURL: string, route: string, data: unknown) {
  const response = await page.context().request.post(`${baseURL}${route}`, { data });

  if (!response.ok()) {
    throw new Error(`${route} failed with ${response.status()}: ${await response.text()}`);
  }

  return (await response.json()) as T;
}

async function startRegistrationInBrowser(page: Page, options: unknown) {
  return page.evaluate(async (registrationOptions) => {
    return (globalThis as typeof globalThis & {
      SimpleWebAuthnBrowser: {
        startRegistration: (args: { optionsJSON: unknown }) => Promise<unknown>;
      };
    }).SimpleWebAuthnBrowser.startRegistration({
      optionsJSON: registrationOptions,
    });
  }, options);
}

async function startAuthenticationInBrowser(page: Page, options: unknown) {
  return page.evaluate(async (authenticationOptions) => {
    return (globalThis as typeof globalThis & {
      SimpleWebAuthnBrowser: {
        startAuthentication: (args: { optionsJSON: unknown }) => Promise<unknown>;
      };
    }).SimpleWebAuthnBrowser.startAuthentication({
      optionsJSON: authenticationOptions,
    });
  }, options);
}

async function registerWithPasskey(page: Page, baseURL: string, email: string, workspaceName: string) {
  const begin = await browserPost<{ options: unknown }>(page, baseURL, "/api/v1/auth/passkeys/register/options", {
    email,
    workspaceName,
  });
  const response = await startRegistrationInBrowser(page, begin.options);
  await browserPost(page, baseURL, "/api/v1/auth/passkeys/register/verify", { response });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: workspaceName })).toBeVisible();
}

async function enrollPasskey(page: Page, baseURL: string) {
  const begin = await browserPost<{ options: unknown }>(page, baseURL, "/api/v1/auth/passkeys/enroll/options", {});
  const response = await startRegistrationInBrowser(page, begin.options);
  await browserPost(page, baseURL, "/api/v1/auth/passkeys/enroll/verify", { response });
}

async function signInWithPasskey(page: Page, baseURL: string, email: string) {
  const begin = await browserPost<{ options: unknown }>(page, baseURL, "/api/v1/auth/passkeys/login/options", {
    email,
  });
  const response = await startAuthenticationInBrowser(page, begin.options);
  await browserPost(page, baseURL, "/api/v1/auth/passkeys/login/verify", { response });

  await page.goto("/");
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page.locator("form").first().getByLabel("E-Mail")).toBeVisible();
}

async function openPasskeyLogin(page: Page) {
  await page.getByRole("button", { name: "Anmelden" }).first().click();
  await expect(page.getByRole("button", { name: "Mit Passkey anmelden" })).toBeVisible();
}

test.describe("passkey management", () => {
  test.setTimeout(120_000);

  test("supports passkey signup, enrollment, guarded removal, and passkey login", async ({
    browser,
    browserName,
    baseURL,
  }) => {
    test.skip(browserName !== "chromium", "Virtual WebAuthn authenticator requires Chromium.");

    const stamp = Date.now().toString();
    const workspaceName = `Passkey Garten ${stamp}`;
    const email = `passkey-${stamp}@example.com`;

    const context = await browser.newContext();
    const page = await context.newPage();
    const authenticator = await installVirtualAuthenticator(context, page);
    let secondContext: BrowserContext | null = null;
    let secondAuthenticator: VirtualAuthenticator | null = null;

    try {
      await page.addInitScript({ path: simpleWebAuthnBundlePath });
      await page.goto("/");
      await registerWithPasskey(page, baseURL!, email, workspaceName);
      expect(await authenticator.getCredentialCount()).toBe(1);

      await openWorkspaceManager(page);

      const passkeyList = page
        .getByRole("heading", { name: "Gespeicherte Passkeys" })
        .locator("xpath=ancestor::div[1]");
      const passkeyCards = passkeyList.locator("article");

      await expect(page.getByText("Passwort als Reserve: Nein")).toBeVisible();
      await expect(passkeyCards).toHaveCount(1);
      await expect(passkeyCards.first()).toContainText(/Gerätetyp: (Mehrgeräte-Passkey|Nur auf diesem Gerät)/);
      await expect(passkeyCards.first()).toContainText(/Synchronisiert: (Ja|Nein)/);
      await expect(passkeyCards.first()).toContainText("Verbindung: internal");
      await expect(passkeyCards.first().getByRole("button", { name: "Entfernen" })).toBeDisabled();
      await expect(passkeyCards.first()).toContainText(
        "Dieser Passkey ist aktuell Teil Deiner letzten verbleibenden Anmeldemethode.",
      );

      secondContext = await browser.newContext({ storageState: await context.storageState() });
      const secondPage = await secondContext.newPage();
      secondAuthenticator = await installVirtualAuthenticator(secondContext, secondPage);
      await secondPage.addInitScript({ path: simpleWebAuthnBundlePath });
      await secondPage.goto("/");
      await enrollPasskey(secondPage, baseURL!);
      expect(await secondAuthenticator.getCredentialCount()).toBe(1);

      await secondPage.reload();
      await openWorkspaceManager(secondPage);

      const secondPasskeyList = secondPage
        .getByRole("heading", { name: "Gespeicherte Passkeys" })
        .locator("xpath=ancestor::div[1]");
      const secondPasskeyCards = secondPasskeyList.locator("article");

      await expect(secondPasskeyCards).toHaveCount(2);

      secondPage.once("dialog", (dialog) => dialog.accept());
      await secondPasskeyCards.last().getByRole("button", { name: "Entfernen" }).click();
      await expect(secondPage.getByText("Passkey entfernt.")).toBeVisible();
      await expect(secondPasskeyCards).toHaveCount(1);
      await expect(secondPage.getByText("Passwort als Reserve: Nein")).toBeVisible();
      await expect(secondPasskeyCards.first().getByRole("button", { name: "Entfernen" })).toBeDisabled();

      await secondPage.getByRole("button", { name: "Schließen" }).click();
      await signOut(secondPage);
      await openPasskeyLogin(secondPage);
      await signInWithPasskey(secondPage, baseURL!, email);

      await expect(secondPage.getByRole("heading", { name: workspaceName })).toBeVisible();

      const sessionResponse = await secondPage.context().request.get(`${baseURL}/api/v1/auth/session`, {
        failOnStatusCode: false,
      });
      expect(sessionResponse.ok()).toBeTruthy();
      const sessionPayload = (await sessionResponse.json()) as {
        user: { email: string };
        membership: { workspace: { name: string } };
      };
      expect(sessionPayload.user.email).toBe(email);
      expect(sessionPayload.membership.workspace.name).toBe(workspaceName);
    } finally {
      if (secondAuthenticator) {
        await secondAuthenticator.dispose();
      }
      if (secondContext) {
        await secondContext.close();
      }
      await authenticator.dispose();
      await context.close();
    }
  });
});
