const zones = [
  {
    name: "CABA",
    areas: ["Palermo", "Belgrano", "Nunez", "Colegiales", "Villa Urquiza", "Devoto", "Caballito", "y mas..."],
    color: "bg-green-800",
  },
  {
    name: "Zona Norte GBA",
    areas: ["San Isidro", "Vicente Lopez", "Tigre", "San Fernando", "Pilar", "Escobar", "Don Torcuato", "y mas..."],
    color: "bg-green-700",
  },
  {
    name: "Zona Oeste GBA",
    areas: ["Ituzaingo", "Moreno", "Merlo", "Moron", "Hurlingham", "Castelar", "Ramos Mejia", "y mas..."],
    color: "bg-green-600",
  },
];

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  );
}

export default function Coverage() {
  return (
    <section id="cobertura" className="py-20 sm:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-green-900 mb-4">
            Zona de Cobertura
          </h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Cubrimos CABA, Zona Norte y Zona Oeste del Gran Buenos Aires.
            Consulta por tu barrio.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
          {zones.map((zone) => (
            <div
              key={zone.name}
              className="rounded-2xl overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow"
            >
              <div className={`${zone.color} px-6 py-5 flex items-center gap-3`}>
                <MapPinIcon className="w-6 h-6 text-white/80" />
                <h3 className="text-xl font-bold text-white">{zone.name}</h3>
              </div>
              <div className="p-6">
                <div className="flex flex-wrap gap-2">
                  {zone.areas.map((area) => (
                    <span
                      key={area}
                      className="inline-flex items-center gap-1.5 bg-green-50 text-green-800 text-sm px-3 py-1.5 rounded-full font-medium"
                    >
                      <MapPinIcon className="w-3.5 h-3.5 text-green-600" />
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <p className="text-gray-500 mb-4">
            No encontras tu zona? Consultanos, seguramente podemos llegar.
          </p>
          <a
            href="#contacto"
            className="inline-flex items-center gap-2 bg-green-800 text-white px-6 py-3 rounded-full font-semibold hover:bg-green-700 transition-all hover:shadow-lg"
          >
            <MapPinIcon className="w-5 h-5" />
            Consultanos por tu zona
          </a>
        </div>
      </div>
    </section>
  );
}
