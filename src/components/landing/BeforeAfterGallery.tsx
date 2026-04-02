"use client";

import { useState, useRef, useCallback } from "react";

interface GalleryItem {
  id: number;
  title: string;
  location: string;
}

const galleryItems: GalleryItem[] = [
  { id: 1, title: "Corte de cesped residencial", location: "San Isidro, Zona Norte" },
  { id: 2, title: "Desmalezamiento completo", location: "Palermo, CABA" },
  { id: 3, title: "Poda y limpieza integral", location: "Ituzaingo, Zona Oeste" },
  { id: 4, title: "Limpieza de terreno abandonado", location: "Tigre, Zona Norte" },
];

function BeforeAfterSlider({ item }: { item: GalleryItem }) {
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current || !isDragging.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percent = Math.max(5, Math.min(95, (x / rect.width) * 100));
    setSliderPos(percent);
  }, []);

  return (
    <div className="group rounded-2xl overflow-hidden bg-gray-100 shadow-sm hover:shadow-lg transition-shadow">
      <div
        ref={containerRef}
        className="relative aspect-[4/3] cursor-col-resize select-none"
        onMouseDown={() => { isDragging.current = true; }}
        onMouseUp={() => { isDragging.current = false; }}
        onMouseLeave={() => { isDragging.current = false; }}
        onMouseMove={(e) => handleMove(e.clientX)}
        onTouchStart={() => { isDragging.current = true; }}
        onTouchEnd={() => { isDragging.current = false; }}
        onTouchMove={(e) => handleMove(e.touches[0].clientX)}
      >
        {/* "After" side (full background) */}
        <div className="absolute inset-0 bg-gradient-to-br from-green-300 to-green-500 flex items-center justify-center">
          <div className="text-center text-green-900/40">
            <svg className="w-12 h-12 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-bold tracking-wider">DESPUES</p>
          </div>
        </div>

        {/* "Before" side (clipped) */}
        <div
          className="absolute inset-0 bg-gradient-to-br from-amber-200 to-amber-400 flex items-center justify-center"
          style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
        >
          <div className="text-center text-amber-900/40">
            <svg className="w-12 h-12 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
            </svg>
            <p className="text-sm font-bold tracking-wider">ANTES</p>
          </div>
        </div>

        {/* Slider line + handle */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-10"
          style={{ left: `${sliderPos}%`, transform: "translateX(-50%)" }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center border-2 border-green-600">
            <svg className="w-5 h-5 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
            </svg>
          </div>
        </div>

        {/* Labels */}
        <span className="absolute top-3 left-3 bg-black/50 text-white text-xs font-semibold px-3 py-1 rounded-full z-10">
          ANTES
        </span>
        <span className="absolute top-3 right-3 bg-green-700/80 text-white text-xs font-semibold px-3 py-1 rounded-full z-10">
          DESPUES
        </span>
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-gray-900">{item.title}</h3>
        <p className="text-sm text-gray-500">{item.location}</p>
      </div>
    </div>
  );
}

export default function BeforeAfterGallery() {
  return (
    <section id="galeria" className="py-20 sm:py-28 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-green-900 mb-4">
            Nuestros Resultados
          </h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Desliza para ver la transformacion. Cada trabajo habla por si mismo.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto">
          {galleryItems.map((item) => (
            <BeforeAfterSlider key={item.id} item={item} />
          ))}
        </div>

        <div className="text-center mt-12">
          <a
            href="#contacto"
            className="inline-flex items-center gap-2 bg-green-800 text-white px-6 py-3 rounded-full font-semibold hover:bg-green-700 transition-all hover:shadow-lg"
          >
            Quiero resultados asi
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
