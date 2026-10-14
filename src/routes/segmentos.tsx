import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/segmentos")({
  beforeLoad: () => {
    throw redirect({ to: "/produtos" });
  },
});
