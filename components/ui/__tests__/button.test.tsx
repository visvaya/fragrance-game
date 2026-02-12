import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { Button } from "../button";

describe("Button", () => {
  it("renders correctly", () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole("button", { name: /click me/i });
    expect(button).toBeInTheDocument();
  });

  it("applies variant classes", () => {
    render(<Button variant="destructive">Delete</Button>);
    const button = screen.getByRole("button", { name: /delete/i });
    expect(button).toHaveClass("bg-destructive");
  });

  it("applies size classes", () => {
    render(<Button size="lg">Large Button</Button>);
    const button = screen.getByRole("button", { name: /large button/i });
    expect(button).toHaveClass("h-10");
  });
  it("matches snapshot", () => {
    const { asFragment } = render(<Button>Snapshot Button</Button>);
    expect(asFragment()).toMatchSnapshot();
  });

  it("matches destructive variant snapshot", () => {
    const { asFragment } = render(
      <Button variant="destructive">Destructive</Button>,
    );
    expect(asFragment()).toMatchSnapshot();
  });

  it("matches ghost variant snapshot", () => {
    const { asFragment } = render(<Button variant="ghost">Ghost</Button>);
    expect(asFragment()).toMatchSnapshot();
  });
});
