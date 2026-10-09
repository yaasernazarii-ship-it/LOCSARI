import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  alternates: { canonical: "/amlak" },
};

export default function HomePage() {
  redirect("/amlak");
}
