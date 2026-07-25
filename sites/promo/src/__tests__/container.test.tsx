import { Container } from "@/components/container";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("Container", () => {
  it("renders children", () => {
    render(<Container>Hello World</Container>);
    expect(screen.getByText("Hello World")).toBeDefined();
  });

  it("renders with custom class", () => {
    const { container } = render(<Container className="custom-class">Content</Container>);
    expect(container.firstElementChild?.className).toContain("custom-class");
  });

  it("renders with id", () => {
    render(<Container id="test-id">Content</Container>);
    expect(screen.getByText("Content").closest("#test-id")).toBeDefined();
  });
});
