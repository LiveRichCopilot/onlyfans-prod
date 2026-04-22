import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./demo.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const serif = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "Lucy · Sales DNA Brief",
  description: "Private briefing",
  robots: { index: false, follow: false },
};

export default function LucyDemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${inter.variable} ${serif.variable} demo-root`}>
      {children}
    </div>
  );
}
