export default function StructuredData() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "The Green Side",
    description:
      "Servicio profesional de mantenimiento de espacios verdes, jardineria y paisajismo en Buenos Aires.",
    url: process.env.NEXT_PUBLIC_SITE_URL || "https://thegreenside.com.ar",
    telephone: process.env.NEXT_PUBLIC_PHONE || "+5491100000000",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Buenos Aires",
      addressRegion: "Buenos Aires",
      addressCountry: "AR",
    },
    areaServed: [
      {
        "@type": "City",
        name: "Ciudad Autonoma de Buenos Aires",
      },
      {
        "@type": "AdministrativeArea",
        name: "Zona Norte, Buenos Aires",
      },
      {
        "@type": "AdministrativeArea",
        name: "Zona Oeste, Buenos Aires",
      },
    ],
    serviceType: "Landscaping",
    priceRange: "$$",
    image:
      process.env.NEXT_PUBLIC_SITE_URL
        ? `${process.env.NEXT_PUBLIC_SITE_URL}/og-image.jpg`
        : "https://thegreenside.com.ar/og-image.jpg",
    sameAs: [],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
