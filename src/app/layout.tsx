import type { Metadata } from "next";
import { Montserrat, Inter } from "next/font/google";
import "./globals.css";
import GoogleAnalytics from "@/components/analytics/GoogleAnalytics";
import MetaPixel from "@/components/analytics/MetaPixel";
import StructuredData from "@/components/landing/StructuredData";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://proyecto-pasto.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "The Green Side | Mantenimiento de Espacios Verdes en Buenos Aires",
    template: "%s | The Green Side",
  },
  description:
    "Servicio profesional de mantenimiento de espacios verdes, jardineria y paisajismo en Buenos Aires. CABA, Zona Norte y Zona Oeste.",
  keywords: [
    "mantenimiento espacios verdes",
    "jardineria Buenos Aires",
    "paisajismo",
    "corte de pasto",
    "parquizacion",
    "CABA",
    "Zona Norte",
    "Zona Oeste",
  ],
  authors: [{ name: "The Green Side" }],
  creator: "The Green Side",
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: BASE_URL,
    siteName: "The Green Side",
    title: "The Green Side | Mantenimiento de Espacios Verdes en Buenos Aires",
    description:
      "Servicio profesional de mantenimiento de espacios verdes, jardineria y paisajismo en Buenos Aires.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "The Green Side - Espacios Verdes",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Green Side | Espacios Verdes en Buenos Aires",
    description:
      "Servicio profesional de mantenimiento de espacios verdes, jardineria y paisajismo en Buenos Aires.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${montserrat.variable} ${inter.variable} antialiased`}
    >
      <head>
        <meta name="theme-color" content="#2D6A4F" />
        <StructuredData />
      </head>
      <body className="min-h-screen flex flex-col">
        {children}
        <GoogleAnalytics />
        <MetaPixel />
      </body>
    </html>
  );
}
