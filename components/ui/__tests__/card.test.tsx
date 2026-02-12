import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from "../card";

describe("Card", () => {
  it("matches snapshot with all subcomponents", () => {
    const { asFragment } = render(
      <Card>
        <CardHeader>
          <CardTitle>Card Title</CardTitle>
          <CardDescription>Card Description</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Card Content</p>
        </CardContent>
        <CardFooter>
          <p>Card Footer</p>
        </CardFooter>
      </Card>,
    );
    expect(asFragment()).toMatchSnapshot();
  });
});
