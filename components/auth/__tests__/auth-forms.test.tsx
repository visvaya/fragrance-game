import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ForgotPasswordForm } from "../forgot-password-form";
import { LoginForm } from "../login-form";
import { RegisterForm } from "../register-form";
import { ResetPasswordForm } from "../reset-password-form";

const { mockAuth, mockPublicEnv, mockRouter, mockSafety, mockToast } =
  vi.hoisted(() => ({
    mockAuth: {
      resetPasswordForEmail: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      updateUser: vi.fn(),
    },
    mockPublicEnv: {
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: undefined as string | undefined,
    },
    mockRouter: { push: vi.fn(), refresh: vi.fn() },
    mockSafety: vi.fn(),
    mockToast: { error: vi.fn(), success: vi.fn() },
  }));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: mockAuth }),
}));
vi.mock("@/lib/public-env", () => ({ publicEnv: mockPublicEnv }));
vi.mock("@/i18n/routing", () => ({ useRouter: () => mockRouter }));
vi.mock("@/app/actions/security-actions", () => ({
  validatePasswordSafety: mockSafety,
}));
// Keys come back with their namespace, so a message read through another namespace still matches.
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
}));
vi.mock("@/lib/toast", () => ({ toast: mockToast }));
vi.mock("../google-auth-button", () => ({
  GoogleAuthButton: () => <button type="button">google</button>,
}));
vi.mock("next/dynamic", () => ({
  default: () =>
    function CaptchaStub({
      onFail,
      onVerify,
    }: {
      onFail?: (kind: string) => void;
      onVerify: (token: string) => void;
    }) {
      return (
        <>
          <button onClick={() => onVerify("captcha-token")} type="button">
            captcha
          </button>
          <button onClick={() => onFail?.("blocked")} type="button">
            captcha script failed
          </button>
          <button onClick={() => onFail?.("challenge")} type="button">
            captcha challenge failed
          </button>
        </>
      );
    },
}));

const STRONG_PASSWORD = "Str0ng!pass";

beforeEach(() => {
  vi.clearAllMocks();
  mockPublicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY = undefined;
  mockAuth.resetPasswordForEmail.mockResolvedValue({ error: null });
  mockAuth.signInWithPassword.mockResolvedValue({ error: null });
  mockAuth.signUp.mockResolvedValue({ error: null });
  mockAuth.updateUser.mockResolvedValue({ error: null });
  mockSafety.mockResolvedValue({ isSafe: true });
});

describe("LoginForm", () => {
  it("signs in and calls onSuccess", async () => {
    const onSuccess = vi.fn();
    render(<LoginForm onSuccess={onSuccess} />);
    await userEvent.type(
      screen.getByLabelText("Auth.login.emailLabel"),
      "a@b.co",
    );
    await userEvent.type(
      screen.getByLabelText("Auth.login.passwordLabel"),
      "secret",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Auth.login.submit" }),
    );

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
    expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({
      email: "a@b.co",
      password: "secret",
    });
    expect(mockToast.success).toHaveBeenCalledWith("Auth.login.success");
  });

  it("shows the provider error and stays on the form", async () => {
    mockAuth.signInWithPassword.mockResolvedValue({
      error: { message: "bad credentials" },
    });
    render(<LoginForm />);
    await userEvent.type(
      screen.getByLabelText("Auth.login.emailLabel"),
      "a@b.co",
    );
    await userEvent.type(
      screen.getByLabelText("Auth.login.passwordLabel"),
      "secret",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Auth.login.submit" }),
    );

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Auth.login.failed", {
        description: "bad credentials",
      });
    });
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Auth.login.submit" }),
    ).toBeEnabled();
  });

  it("disables the submit button while the request runs", async () => {
    const request = Promise.withResolvers<{ error: null }>();
    mockAuth.signInWithPassword.mockReturnValue(request.promise);
    render(<LoginForm onSuccess={vi.fn()} />);
    await userEvent.type(
      screen.getByLabelText("Auth.login.emailLabel"),
      "a@b.co",
    );
    await userEvent.type(
      screen.getByLabelText("Auth.login.passwordLabel"),
      "secret",
    );
    const submit = screen.getByRole("button", { name: "Auth.login.submit" });
    await userEvent.click(submit);

    await waitFor(() => {
      expect(submit).toBeDisabled();
    });
    request.resolve({ error: null });
    await waitFor(() => {
      expect(submit).toBeEnabled();
    });
  });

  it("signs in once when the form is submitted twice before the button disables", async () => {
    const request = Promise.withResolvers<{ error: null }>();
    mockAuth.signInWithPassword.mockReturnValue(request.promise);
    render(<LoginForm onSuccess={vi.fn()} />);
    await userEvent.type(
      screen.getByLabelText("Auth.login.emailLabel"),
      "a@b.co",
    );
    await userEvent.type(
      screen.getByLabelText("Auth.login.passwordLabel"),
      "secret",
    );
    const submit = screen.getByRole<HTMLButtonElement>("button", {
      name: "Auth.login.submit",
    });
    // Two submits in one task, as a double tap or Enter plus tap can deliver them.
    const { form } = submit;
    expect(form).not.toBeNull();
    if (form) {
      fireEvent.submit(form);
      fireEvent.submit(form);
    }

    await waitFor(() => {
      expect(submit).toBeDisabled();
    });
    request.resolve({ error: null });
    await waitFor(() => {
      expect(submit).toBeEnabled();
    });
    expect(mockAuth.signInWithPassword).toHaveBeenCalledTimes(1);
  });

  it("rejects an invalid email", async () => {
    render(<LoginForm />);
    await userEvent.type(
      screen.getByLabelText("Auth.login.emailLabel"),
      "nope",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Auth.login.submit" }),
    );

    expect(
      await screen.findByText("Auth.login.invalidEmail"),
    ).toBeInTheDocument();
    expect(mockAuth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("asks for the password when it is empty", async () => {
    render(<LoginForm />);
    await userEvent.type(
      screen.getByLabelText("Auth.login.emailLabel"),
      "a@b.co",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Auth.login.submit" }),
    );

    expect(
      await screen.findByText("Auth.login.passwordRequired"),
    ).toBeInTheDocument();
    expect(mockAuth.signInWithPassword).not.toHaveBeenCalled();
  });

  describe("with a captcha site key", () => {
    async function fillAndSubmit() {
      await userEvent.type(
        screen.getByLabelText("Auth.login.emailLabel"),
        "a@b.co",
      );
      await userEvent.type(
        screen.getByLabelText("Auth.login.passwordLabel"),
        "secret",
      );
      await userEvent.click(
        screen.getByRole("button", { name: "Auth.login.submit" }),
      );
    }

    beforeEach(() => {
      mockPublicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";
    });

    it("requires the captcha before signing in", async () => {
      render(<LoginForm />);
      await fillAndSubmit();

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith("Auth.login.captchaError");
      });
      expect(mockAuth.signInWithPassword).not.toHaveBeenCalled();
    });

    it("signs in with the captcha token", async () => {
      render(<LoginForm onSuccess={vi.fn()} />);
      await userEvent.click(screen.getByRole("button", { name: "captcha" }));
      await fillAndSubmit();

      await waitFor(() => {
        expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({
          email: "a@b.co",
          options: { captchaToken: "captcha-token" },
          password: "secret",
        });
      });
    });

    it("advises a reload when the captcha cannot load", async () => {
      render(<LoginForm />);
      await userEvent.click(
        screen.getByRole("button", { name: "captcha script failed" }),
      );

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Auth.captchaErrors.blocked",
      );
      expect(
        screen.queryByRole("button", { name: "captcha" }),
      ).not.toBeInTheDocument();
    });

    it("says why the check failed and keeps the widget for another try", async () => {
      render(<LoginForm />);
      await userEvent.click(
        screen.getByRole("button", { name: "captcha challenge failed" }),
      );

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Auth.captchaErrors.challenge",
      );
      await userEvent.click(screen.getByRole("button", { name: "captcha" }));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("needs a new captcha token after a rejected sign-in", async () => {
      mockAuth.signInWithPassword.mockResolvedValue({
        error: { message: "bad credentials" },
      });
      render(<LoginForm />);
      await userEvent.click(screen.getByRole("button", { name: "captcha" }));
      await fillAndSubmit();
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith("Auth.login.failed", {
          description: "bad credentials",
        });
      });

      await userEvent.click(
        screen.getByRole("button", { name: "Auth.login.submit" }),
      );

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith("Auth.login.captchaError");
      });
      expect(mockAuth.signInWithPassword).toHaveBeenCalledTimes(1);
    });
  });

  it("links to the other auth screens", async () => {
    const onRegisterClick = vi.fn();
    const onForgotPasswordClick = vi.fn();
    render(
      <LoginForm
        onForgotPasswordClick={onForgotPasswordClick}
        onRegisterClick={onRegisterClick}
      />,
    );
    expect(screen.getByRole("button", { name: "google" })).toBeInTheDocument();
    expect(screen.getByText("Auth.common.or")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Auth.login.signUpLink" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Auth.login.forgotPassword" }),
    );
    expect(onRegisterClick).toHaveBeenCalled();
    expect(onForgotPasswordClick).toHaveBeenCalled();
  });
});

describe("RegisterForm", () => {
  beforeEach(() => {
    mockPublicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";
  });

  async function fill(password: string, confirmPassword = password) {
    await userEvent.type(
      screen.getByLabelText("Auth.register.emailLabel"),
      "a@b.co",
    );
    await userEvent.type(
      screen.getByLabelText("Auth.register.passwordLabel"),
      password,
    );
    await userEvent.type(
      screen.getByLabelText("Auth.register.confirmPasswordLabel"),
      confirmPassword,
    );
  }

  it("asks to repeat the password when the confirmation is empty", async () => {
    render(<RegisterForm />);
    await userEvent.type(
      screen.getByLabelText("Auth.register.emailLabel"),
      "a@b.co",
    );
    await userEvent.type(
      screen.getByLabelText("Auth.register.passwordLabel"),
      STRONG_PASSWORD,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Auth.register.submit" }),
    );

    expect(
      await screen.findByText("Auth.register.confirmPasswordRequired"),
    ).toBeInTheDocument();
    expect(mockAuth.signUp).not.toHaveBeenCalled();
  });

  it("requires the captcha", async () => {
    render(<RegisterForm />);
    await fill(STRONG_PASSWORD);
    await userEvent.click(
      screen.getByRole("button", { name: "Auth.register.submit" }),
    );

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        "Auth.register.captchaError",
      );
    });
    expect(mockAuth.signUp).not.toHaveBeenCalled();
  });

  it("signs up with the captcha token", async () => {
    const onSuccess = vi.fn();
    render(<RegisterForm onSuccess={onSuccess} />);
    await fill(STRONG_PASSWORD);
    await userEvent.click(screen.getByRole("button", { name: "captcha" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Auth.register.submit" }),
    );

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
    expect(mockAuth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "a@b.co",
        options: expect.objectContaining({ captchaToken: "captcha-token" }),
        password: STRONG_PASSWORD,
      }),
    );
  });

  it("needs a new captcha token after a rejected sign-up", async () => {
    mockAuth.signUp.mockResolvedValue({ error: { message: "rejected" } });
    render(<RegisterForm />);
    await fill(STRONG_PASSWORD);
    await userEvent.click(screen.getByRole("button", { name: "captcha" }));
    const submit = screen.getByRole("button", { name: "Auth.register.submit" });
    await userEvent.click(submit);
    await waitFor(() => {
      expect(mockAuth.signUp).toHaveBeenCalledTimes(1);
    });

    await userEvent.click(submit);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        "Auth.register.captchaError",
      );
    });
    expect(mockAuth.signUp).toHaveBeenCalledTimes(1);
  });

  it("rejects a common password reported by the server", async () => {
    mockSafety.mockResolvedValue({ isSafe: false });
    render(<RegisterForm />);
    await fill(STRONG_PASSWORD);
    await userEvent.click(screen.getByRole("button", { name: "captcha" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Auth.register.submit" }),
    );

    expect(
      await screen.findByText("Auth.register.passwordCommon"),
    ).toBeInTheDocument();
    expect(mockAuth.signUp).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Auth.register.submit" }),
    ).toBeEnabled();
  });

  it("titles a provider error as unexpected", async () => {
    mockAuth.signUp.mockResolvedValue({ error: { message: "rate limited" } });
    render(<RegisterForm />);
    await fill(STRONG_PASSWORD);
    await userEvent.click(screen.getByRole("button", { name: "captcha" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Auth.register.submit" }),
    );

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        "Auth.register.unexpectedError",
        { description: "rate limited" },
      );
    });
  });

  it("rejects a weak password and a mismatched confirmation", async () => {
    render(<RegisterForm />);
    await fill("short", "other");
    await userEvent.click(
      screen.getByRole("button", { name: "Auth.register.submit" }),
    );

    expect(
      await screen.findByText("Auth.register.passwordMinLength"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Auth.register.passwordsDoNotMatch"),
    ).toBeInTheDocument();
  });
});

describe("ResetPasswordForm", () => {
  async function fill(password: string, confirmPassword = password) {
    await userEvent.type(
      screen.getByLabelText("Auth.resetPassword.newPasswordLabel"),
      password,
    );
    await userEvent.type(
      screen.getByLabelText("Auth.resetPassword.confirmPasswordLabel"),
      confirmPassword,
    );
  }

  it("updates the password and goes home", async () => {
    render(<ResetPasswordForm />);
    await fill(STRONG_PASSWORD);
    await userEvent.click(
      screen.getByRole("button", { name: "Auth.resetPassword.submit" }),
    );

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith("/");
    });
    expect(mockAuth.updateUser).toHaveBeenCalledWith({
      password: STRONG_PASSWORD,
    });
    expect(mockRouter.refresh).toHaveBeenCalled();
  });

  it("uses the registration password rules", async () => {
    render(<ResetPasswordForm />);
    await fill("alllowercase1!", "different");
    await userEvent.click(
      screen.getByRole("button", { name: "Auth.resetPassword.submit" }),
    );

    expect(
      await screen.findByText("Auth.register.passwordUppercase"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Auth.register.passwordsDoNotMatch"),
    ).toBeInTheDocument();
  });

  it("rejects a common password reported by the server", async () => {
    mockSafety.mockResolvedValue({ isSafe: false });
    render(<ResetPasswordForm />);
    await fill(STRONG_PASSWORD);
    await userEvent.click(
      screen.getByRole("button", { name: "Auth.resetPassword.submit" }),
    );

    expect(
      await screen.findByText("Auth.register.passwordCommon"),
    ).toBeInTheDocument();
    expect(mockAuth.updateUser).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Auth.resetPassword.submit" }),
    ).toBeEnabled();
  });

  it("shows the unexpected error title when the request throws", async () => {
    mockAuth.updateUser.mockRejectedValue(new Error("network down"));
    vi.spyOn(console, "error").mockImplementation(vi.fn());
    render(<ResetPasswordForm />);
    await fill(STRONG_PASSWORD);
    await userEvent.click(
      screen.getByRole("button", { name: "Auth.resetPassword.submit" }),
    );

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Auth.resetPassword.error");
    });
    expect(
      screen.getByRole("button", { name: "Auth.resetPassword.submit" }),
    ).toBeEnabled();
  });
});

describe("ForgotPasswordForm", () => {
  it("sends the reset email", async () => {
    render(<ForgotPasswordForm />);
    await userEvent.type(
      screen.getByLabelText("Auth.forgotPassword.emailLabel"),
      "a@b.co",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Auth.forgotPassword.submit" }),
    );

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith(
        "Auth.forgotPassword.success",
        {
          description: "Auth.forgotPassword.successDescription",
        },
      );
    });
    expect(mockAuth.resetPasswordForEmail).toHaveBeenCalledWith(
      "a@b.co",
      expect.objectContaining({
        redirectTo: expect.stringContaining(
          "/auth/callback?next=/auth/reset-password",
        ),
      }),
    );
  });

  describe("with a captcha site key", () => {
    async function fillAndSubmit() {
      await userEvent.type(
        screen.getByLabelText("Auth.forgotPassword.emailLabel"),
        "a@b.co",
      );
      await userEvent.click(
        screen.getByRole("button", { name: "Auth.forgotPassword.submit" }),
      );
    }

    beforeEach(() => {
      mockPublicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";
    });

    it("requires the captcha before sending the email", async () => {
      render(<ForgotPasswordForm />);
      await fillAndSubmit();

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          "Auth.forgotPassword.captchaError",
        );
      });
      expect(mockAuth.resetPasswordForEmail).not.toHaveBeenCalled();
    });

    it("sends the email with the captcha token", async () => {
      render(<ForgotPasswordForm />);
      await userEvent.click(screen.getByRole("button", { name: "captcha" }));
      await fillAndSubmit();

      await waitFor(() => {
        expect(mockAuth.resetPasswordForEmail).toHaveBeenCalledWith(
          "a@b.co",
          expect.objectContaining({ captchaToken: "captcha-token" }),
        );
      });
    });

    it("advises a reload when the captcha cannot load", async () => {
      render(<ForgotPasswordForm />);
      await userEvent.click(
        screen.getByRole("button", { name: "captcha script failed" }),
      );

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Auth.captchaErrors.blocked",
      );
    });

    it("needs a new captcha token after a request", async () => {
      render(<ForgotPasswordForm />);
      await userEvent.click(screen.getByRole("button", { name: "captcha" }));
      await fillAndSubmit();
      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalled();
      });

      await userEvent.click(
        screen.getByRole("button", { name: "Auth.forgotPassword.submit" }),
      );

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          "Auth.forgotPassword.captchaError",
        );
      });
      expect(mockAuth.resetPasswordForEmail).toHaveBeenCalledTimes(1);
    });
  });

  it("goes back to login", async () => {
    const onLoginClick = vi.fn();
    render(<ForgotPasswordForm onLoginClick={onLoginClick} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Auth.forgotPassword.backToLogin" }),
    );
    expect(onLoginClick).toHaveBeenCalled();
  });
});
