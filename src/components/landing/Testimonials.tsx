"use client";

import { useState, useEffect, useCallback } from "react";

const testimonials = [
  {
    name: "Maria L.",
    location: "San Isidro, Zona Norte",
    text: "Excelente servicio. Llegaron puntual, dejaron el jardin impecable y me mandaron fotos del antes y despues. Totalmente recomendable.",
    rating: 5,
  },
  {
    name: "Carlos G.",
    location: "Palermo, CABA",
    text: "Contrate el plan quincenal y es otra cosa. Mi jardin nunca estuvo tan bien cuidado. Muy profesionales y siempre puntuales.",
    rating: 5,
  },
  {
    name: "Ana P.",
    location: "Ituzaingo, Zona Oeste",
    text: "Tenia un terreno totalmente abandonado y lo dejaron increible. El presupuesto fue claro y sin sorpresas. Van a volver seguro.",
    rating: 5,
  },
  {
    name: "Roberto M.",
    location: "Tigre, Zona Norte",
    text: "Lo que mas me gusto es que te mandan fotos de como quedo todo. Se nota que son profesionales de verdad. Super recomendados.",
    rating: 5,
  },
  {
    name: "Lucia F.",
    location: "Belgrano, CABA",
    text: "Contrate el plan semanal y no me arrepiento. El jardin esta siempre perfecto. Lo mejor es que no tengo que preocuparme por nada.",
    rating: 4,
  },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          className={`w-4 h-4 ${i < rating ? "text-amber-400" : "text-gray-300"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export default function Testimonials() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % testimonials.length);
  }, []);

  useEffect(() => {
    if (paused) return;
    const interval = setInterval(next, 5000);
    return () => clearInterval(interval);
  }, [paused, next]);

  // Show 1 card on mobile, 3 on desktop via CSS
  // We'll render a sliding window approach
  const getVisibleIndices = (center: number, total: number) => {
    const indices = [];
    for (let offset = -1; offset <= 1; offset++) {
      indices.push((center + offset + total) % total);
    }
    return indices;
  };

  const visibleIndices = getVisibleIndices(current, testimonials.length);

  return (
    <section id="testimonios" className="py-20 sm:py-28 bg-green-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-green-900 mb-4">
            Lo que dicen nuestros clientes
          </h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            La satisfaccion de nuestros clientes es nuestro mejor respaldo.
          </p>
        </div>

        {/* Carousel */}
        <div
          className="relative"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* Cards - mobile: single, desktop: 3 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {visibleIndices.map((idx, pos) => {
              const testimonial = testimonials[idx];
              return (
                <div
                  key={`${idx}-${pos}`}
                  className={`bg-white rounded-2xl p-6 shadow-sm transition-all duration-300 ${
                    pos === 1 ? "md:scale-105 md:shadow-lg" : "md:opacity-80"
                  } ${pos !== 1 ? "hidden md:block" : ""}`}
                >
                  <StarRating rating={testimonial.rating} />
                  <p className="text-gray-700 text-sm leading-relaxed mt-4 mb-5">
                    &ldquo;{testimonial.text}&rdquo;
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-200 rounded-full flex items-center justify-center">
                      <span className="text-green-800 font-bold text-sm">
                        {testimonial.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-gray-900">
                        {testimonial.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {testimonial.location}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Navigation dots */}
          <div className="flex justify-center gap-2 mt-8">
            {testimonials.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrent(idx)}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  idx === current
                    ? "bg-green-700 w-8"
                    : "bg-green-300 hover:bg-green-400"
                }`}
                aria-label={`Ver testimonio ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Google reviews CTA */}
        <div className="text-center mt-10">
          <div className="inline-flex items-center gap-2 bg-white px-6 py-3 rounded-full shadow-sm">
            <div className="flex -space-x-1">
              {[...Array(5)].map((_, i) => (
                <svg key={i} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <span className="text-sm font-medium text-gray-700">
              5.0 en Google Maps
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
