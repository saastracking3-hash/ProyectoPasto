import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Iniciar Sesion",
  description:
    "Ingresa a tu cuenta de The Green Side para gestionar tus servicios de mantenimiento de espacios verdes.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
