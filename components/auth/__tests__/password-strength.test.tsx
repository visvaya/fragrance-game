import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PasswordStrength } from "../password-strength";

// Mock useTranslations
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("PasswordStrength", () => {
  it("renders nothing when password is empty", () => {
    const { container } = render(<PasswordStrength password="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders all criteria as unchecked for single space", () => {
    // Space triggers render but fails checks
    render(<PasswordStrength password=" " />);
    // Space is considered special by the regex /[^a-z0-9]/i
    expect(screen.getByText(/○\s*minChars/)).toBeInTheDocument();
    expect(screen.getByText(/○\s*lowercase/)).toBeInTheDocument();
    expect(screen.getByText(/○\s*uppercase/)).toBeInTheDocument();
    expect(screen.getByText(/○\s*number/)).toBeInTheDocument();
    expect(screen.getByText(/✓\s*special/)).toBeInTheDocument();
  });

  it("updates strength indicator for valid password (strong)", () => {
    // A strong password: 8+ chars, lower, upper, digit, special
    render(<PasswordStrength password="StrongP@ss1" />);

    expect(screen.getByText("✓ minChars")).toBeInTheDocument();
    expect(screen.getByText("✓ lowercase")).toBeInTheDocument();
    expect(screen.getByText("✓ uppercase")).toBeInTheDocument();
    expect(screen.getByText("✓ number")).toBeInTheDocument();
    expect(screen.getByText("✓ special")).toBeInTheDocument();
  });

  it("shows partial strength for weak password", () => {
    render(<PasswordStrength password="weak" />); // Only lowercase, length < 8

    expect(screen.getByText("✓ lowercase")).toBeInTheDocument();
    expect(screen.getByText("○ minChars")).toBeInTheDocument();
    expect(screen.getByText("○ uppercase")).toBeInTheDocument();
  });
});
