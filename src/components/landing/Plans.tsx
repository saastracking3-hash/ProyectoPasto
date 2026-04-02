const plans = [
  {
    name: "Basico",
    frequency: "Quincenal",
    price: "25.000",
    description: "Ideal para jardines chicos que necesitan mantenimiento regular.",
    features: [
      "2 cortes de cesped por mes",
      "Desmalezamiento de canteros",
      "Recoleccion de residuos verdes",
      "Informe con fotos del trabajo",
    ],
    highlighted: false,
  },
  {
    name: "Standard",
    frequency: "Semanal",
    price: "42.000",
    description: "El plan mas elegido. Tu jardin siempre impecable.",
    features: [
      "4 cortes de cesped por mes",
      "Desmalezamiento completo",
      "Bordeado de canteros y veredas",
      "Poda leve de arbustos",
      "Recoleccion de residuos verdes",
      "Informe con fotos del trabajo",
    ],
    highlighted: true,
  },
  {
    name: "Premium",
    frequency: "Integral",
    price: "68.000",
    description: "Para quienes quieren su jardin perfecto todo el tiempo.",
    features: [
      "4 cortes de cesped por mes",
      "Desmalezamiento continuo",
      "Bordeado y perfilado completo",
      "Poda de arbustos y setos",
      "Fertilizacion mensual",
      "Limpieza general del jardin",
      "Informe con fotos del trabajo",
      "Atencion prioritaria",
    ],
    highlighted: false,
  },
];

export default function Plans() {
  return (
    <section id="planes" className="py-20 sm:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-green-900 mb-4">
            Planes de Mantenimiento
          </h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Elegi el plan que mejor se adapte a tu jardin. Todos incluyen
            maquinaria profesional y limpieza post-trabajo.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 sm:gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl p-8 border-2 transition-all ${
                plan.highlighted
                  ? "border-green-600 bg-green-50 shadow-xl scale-[1.02] relative"
                  : "border-gray-200 bg-white hover:border-green-300 hover:shadow-md"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-green-700 text-white text-sm font-semibold px-4 py-1 rounded-full whitespace-nowrap">
                  Mas popular
                </div>
              )}

              <h3 className="text-2xl font-bold text-gray-900 mb-1">
                {plan.name}
              </h3>
              <p className="text-green-700 font-semibold text-sm mb-4">
                {plan.frequency}
              </p>

              <div className="mb-4">
                <span className="text-3xl font-bold text-green-900">
                  ${plan.price}
                </span>
                <span className="text-gray-500 text-sm ml-1">/mes</span>
              </div>

              <p className="text-gray-500 text-sm mb-6">{plan.description}</p>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm">
                    <svg
                      className="w-5 h-5 text-green-600 shrink-0 mt-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <a
                href="https://wa.me/5491100000000?text=Hola!%20Me%20interesa%20el%20plan%20{plan.name}"
                target="_blank"
                rel="noopener noreferrer"
                className={`block text-center py-3 rounded-full font-semibold transition-all ${
                  plan.highlighted
                    ? "bg-green-800 text-white hover:bg-green-700 hover:shadow-lg"
                    : "bg-gray-100 text-gray-900 hover:bg-green-100 hover:text-green-800"
                }`}
              >
                Contratar plan
              </a>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-gray-400 mt-8">
          Precios de referencia para terrenos de hasta 200m2. Los precios pueden variar
          segun el tamaño del terreno y la ubicacion. Pedinos un presupuesto personalizado.
        </p>
      </div>
    </section>
  );
}
