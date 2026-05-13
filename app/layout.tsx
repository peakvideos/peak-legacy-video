import type { Metadata, Viewport } from "next";
import { Alata, Cardo } from "next/font/google";
import { BookingModalProvider } from "@/components/booking/booking-modal-provider";
import { MetaPixelScript } from "@/components/meta-pixel-script";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
const title = "Peak Studios CO — Legacy Video | Victoria & Vancouver, BC";
const description =
  "Beautiful, professional legacy films capturing your loved one's life story in their own words — to be treasured by your family for generations.";

const alata = Alata({
  variable: "--font-alata",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const cardo = Cardo({
  variable: "--font-cardo",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  applicationName: "Peak Studios CO",
  alternates: { canonical: "/" },
  openGraph: {
    title,
    description,
    url: siteUrl,
    siteName: "Peak Studios CO",
    type: "website",
    locale: "en_CA",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#233415",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${alata.variable} ${cardo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <MetaPixelScript />
        <BookingModalProvider>{children}</BookingModalProvider>
      </body>
    </html>
  );
}
