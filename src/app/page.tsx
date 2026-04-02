import type { Metadata } from "next";
import Hero from "@/components/landing/Hero";
import Services from "@/components/landing/Services";
import BeforeAfterGallery from "@/components/landing/BeforeAfterGallery";
import Plans from "@/components/landing/Plans";
import Testimonials from "@/components/landing/Testimonials";
import Coverage from "@/components/landing/Coverage";
import ContactForm from "@/components/landing/ContactForm";
import FAQ from "@/components/landing/FAQ";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import WhatsAppButton from "@/components/landing/WhatsAppButton";

export const metadata: Metadata = {
  title:
    "The Green Side | Mantenimiento de Espacios Verdes en Buenos Aires",
  description:
    "Servicio profesional de mantenimiento de espacios verdes, jardineria y paisajismo en Buenos Aires. Solicita tu presupuesto sin cargo.",
  alternates: {
    canonical: "/",
  },
};

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Hero />
        <Services />
        <BeforeAfterGallery />
        <Plans />
        <Testimonials />
        <Coverage />
        <ContactForm />
        <FAQ />
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
