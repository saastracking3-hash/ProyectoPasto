"use client";

import { useState } from "react";

const faqs = [
  {
    question: "Como funciona el servicio?",
    answer:
      "Nos contactas por WhatsApp o el formulario, te pedimos fotos o datos del terreno, te pasamos un presupuesto sin cargo y coordinamos dia y horario. Al terminar, te enviamos fotos del resultado.",
  },
  {
    question: "Que zonas cubren?",
    answer:
      "Cubrimos CABA, Zona Norte del GBA (San Isidro, Vicente Lopez, Tigre, Pilar, Escobar) y Zona Oeste del GBA (Ituzaingo, Moreno, Merlo, Moron, Hurlingham). Consulta por tu barrio, seguramente llegamos.",
  },
  {
    question: "Cuanto cuesta el servicio?",
    answer:
      "El precio depende del tamaño del terreno, el tipo de servicio y la ubicacion. Pedinos un presupuesto gratis y te damos un precio claro sin sorpresas.",
  },
  {
    question: "Que incluye el mantenimiento periodico?",
    answer:
      "Incluye corte de cesped, desmalezamiento, bordeado y recoleccion de residuos verdes. Segun el plan, tambien poda de arbustos, fertilizacion y limpieza general.",
  },
  {
    question: "Que medios de pago aceptan?",
    answer:
      "Aceptamos efectivo, transferencia bancaria y Mercado Pago. Te pasamos los datos una vez confirmado el servicio.",
  },
  {
    question: "Trabajan fines de semana?",
    answer:
      "Si, trabajamos de lunes a sabado. Domingos y feriados con coordinacion previa.",
  },
  {
    question: "Que pasa si llueve el dia del servicio?",
    answer:
      "Reprogramamos para el dia habil mas proximo sin costo adicional. Te avisamos con anticipacion.",
  },
  {
    question: "Retiran los residuos del corte?",
    answer:
      "Si, retiramos todos los residuos verdes generados por el trabajo. Dejamos tu espacio completamente limpio.",
  },
  {
    question: "Puedo cancelar mi plan en cualquier momento?",
    answer:
      "Si, nuestros planes no tienen permanencia minima. Podes cancelar o modificar tu plan cuando quieras avisando con al menos 48hs de anticipacion.",
  },
  {
    question: "Hacen trabajos puntuales sin plan mensual?",
    answer:
      "Si, hacemos trabajos puntuales. El precio se cotiza segun el trabajo a realizar. Contactanos y te pasamos un presupuesto a medida.",
  },
];

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-gray-200">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left group"
      >
        <span className="font-semibold text-gray-900 pr-4 group-hover:text-green-800 transition-colors">
          {question}
        </span>
        <span
          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
            open
              ? "bg-green-700 text-white rotate-0"
              : "bg-green-100 text-green-700 rotate-0"
          }`}
        >
          {open ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          )}
        </span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${
          open ? "max-h-96 pb-5" : "max-h-0"
        }`}
      >
        <p className="text-gray-600 leading-relaxed text-sm pr-12">
          {answer}
        </p>
      </div>
    </div>
  );
}

export default function FAQ() {
  return (
    <section id="faq" className="py-20 sm:py-28 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-green-900 mb-4">
            Preguntas Frecuentes
          </h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Respuestas a las consultas mas comunes sobre nuestros servicios.
          </p>
        </div>

        <div>
          {faqs.map((faq) => (
            <FAQItem key={faq.question} question={faq.question} answer={faq.answer} />
          ))}
        </div>

        <div className="text-center mt-10">
          <p className="text-gray-500 mb-3">Tenes otra pregunta?</p>
          <a
            href="#contacto"
            className="inline-flex items-center gap-2 text-green-800 font-semibold hover:text-green-600 transition-colors"
          >
            Escribinos y te respondemos
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
