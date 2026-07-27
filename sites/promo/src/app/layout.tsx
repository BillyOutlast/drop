import "@/styles/tailwind.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s - Drop OSS",
    default: "Drop - An open Steam",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-100 antialiased">{children}</body>
    </html>
  );
}
