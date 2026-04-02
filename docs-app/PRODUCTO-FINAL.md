# Documento detallado del producto final - App de mantenimiento de areas verdes

## 1. Vision general

Plataforma integral para gestionar de punta a punta un servicio profesional de mantenimiento de areas verdes. No es solo una app para pedir un jardinero, es un sistema operativo completo.

**Tres productos conectados:**
- **App Cliente**: simple y prolija para contratar y seguir servicios
- **App Operativa (Campo)**: para cuadrillas y jefes de equipo
- **Panel Administrativo (Backoffice)**: robusto para administrar toda la operacion

## 2. Objetivo del sistema

Convertir un negocio de mantenimiento de areas verdes en una operacion digitalizada, trazable, escalable y controlable.

## 3. Flujo operativo

1. Cliente entra a la app o web
2. Solicita servicio o contrata plan recurrente
3. Carga ubicacion, fotos, detalles y necesidades
4. Sistema evalua si cotiza automaticamente o requiere revision manual
5. Empresa confirma/ajusta/aprueba presupuesto
6. Sistema agenda el trabajo
7. Administracion asigna cuadrilla, herramientas, insumos y vehiculo
8. Cliente recibe confirmacion con dia, horario y estado
9. Equipo sale a trabajar
10. Cliente ve seguimiento en tiempo real
11. Equipo hace check-in al llegar
12. Ejecuta trabajo con checklist operativo
13. Sube fotos, observaciones, tiempos, materiales y novedades
14. Cliente recibe cierre y puede calificar
15. Sistema guarda historial, facturacion, analitica y performance

## 4. Tipos de clientes

- **Residencial**: casas, duplex, jardines privados, patios, terrazas verdes
- **Corporativo**: oficinas, locales, galpones, complejos empresariales
- **Consorcios/edificios/barrios cerrados**: torres, countries, espacios comunes
- **Grandes superficies**: parques, predios, canchas, clubes

## 5. Tipos de usuarios del sistema

- Cliente final
- Administrador central
- Supervisor
- Jefe de cuadrilla
- Operario
- Personal de presupuestos
- Personal de logistica
- Dueno / direccion

## 6. Modulos principales (20 modulos)

### 6.1 Modulo de clientes
Registro, perfil, multiples domicilios, historial, medios de pago, preferencias, facturacion, responsables autorizantes.

### 6.2 Modulo de solicitud de servicio
Elegir tipo de servicio, unico o recurrente, ubicacion, fotos/videos, urgencia, fecha/franja horaria, restricciones de acceso.

Tipos de servicio: corte de cesped, poda, desmalezado, limpieza de hojas, mantenimiento general, riego, canteros, remocion residuos verdes, mantenimiento integral programado.

### 6.3 Modulo de planes recurrentes
Planes semanales, quincenales, mensuales, personalizados, contratos por temporada, mantenimiento anual. Generacion automatica de servicios futuros.

### 6.4 Modulo de cotizacion inteligente
- **Automatica**: para trabajos simples (superficie, frecuencia, zona, tipo, complejidad, tiempo, operarios)
- **Asistida/manual**: para trabajos complejos (poda grande, terrenos amplios, corporativos)

### 6.5 Modulo de agenda y planificacion
Calendario diario/semanal/mensual, agrupacion por zona, tiempos de traslado, reprogramacion por clima, reserva de maquinaria.

### 6.6 Modulo de asignacion de cuadrillas
Disponibilidad, habilidades, experiencia, calificacion interna, herramientas, vehiculo, cercania geografica, carga horaria.

### 6.7 Modulo de geolocalizacion y seguimiento en tiempo real
Estados: asignado, salio, en camino, ETA, llego, inicio, finalizacion, salida. Mapa en vivo para administracion.

### 6.8 Modulo de operacion en campo
Trabajos del dia, detalle del servicio, navegacion, estados, checklist, fotos/videos, incidentes, materiales, tiempos, cierre. Diseñado para uso real en la calle con conectividad inestable.

### 6.9 Modulo de checklist operativo
Checklists configurables por tipo de trabajo. Estandariza calidad y controla ejecucion.

### 6.10 Modulo de evidencia fotografica y documental
Fotos antes/durante/despues, videos, firma del cliente, observaciones, comprobantes, remitos, tickets.

### 6.11 Modulo de materiales e insumos
Separacion de mano de obra, materiales, insumos, herramientas, gastos extraordinarios. Estimado vs real. Compras con tickets.

### 6.12 Modulo de maquinaria y herramientas
Inventario, ubicacion, asignacion, estado, mantenimiento, disponibilidad. Bloqueo de conflictos de uso.

### 6.13 Modulo climatico y reprogramacion inteligente
Consulta meteorologica, alertas por lluvia, reprogramacion masiva, notificacion al cliente.

### 6.14 Modulo de comunicacion y notificaciones
Push, email, WhatsApp, SMS. Notificaciones automaticas al cliente y al equipo interno.

### 6.15 Modulo de calificaciones y control de calidad
Calificacion del cliente (puntualidad, prolijidad, resultado, atencion, experiencia). Calificacion interna por equipo/operario.

### 6.16 Modulo de supervision
Trabajos activos, auditar cierres, revisar fotos, validar materiales extra, aprobar horas adicionales, reabrir trabajos.

### 6.17 Modulo de facturacion y pagos
Servicios unicos, suscripciones, facturas, historial de pagos, señas, links de pago, cuentas corrientes corporativas. Separacion mano de obra/materiales/extras/descuentos/impuestos.

### 6.18 Modulo de contratos corporativos
Contratos por periodo, frecuencia, SLA, responsables, topes de gasto, reportes mensuales, facturacion centralizada.

### 6.19 Modulo de historial completo
Historial por cliente, por ubicacion y por operario/cuadrilla.

### 6.20 Modulo analitico y dashboard
Servicios por periodo, ocupacion cuadrillas, rentabilidad, recurrencia, tiempos promedio, cumplimiento, reclamos, satisfaccion, costos, productividad por zona.

## 7. Estados de un servicio

solicitud creada -> pendiente de revision -> cotizado -> pendiente de aprobacion -> aprobado -> agendado -> cuadrilla asignada -> en camino -> llego -> en ejecucion -> pausado -> requiere aprobacion extra -> finalizado por cuadrilla -> validado por supervisor -> cerrado -> facturado -> cobrado -> reclamado -> reabierto

## 8. Puntos clave

- No es un marketplace libre: la empresa controla la asignacion
- Trazabilidad es central: todo queda registrado
- Agenda y logistica son tan importantes como la venta
- Foco en escalabilidad: multiples zonas, bases, cuadrillas, tipos de cliente
- Arquitectura modular

## 9. Integraciones futuras posibles

Proveedores de insumos, stock en tiempo real, billetera/pagos propio, seguros, CRM, WhatsApp automatizado, sistemas contables, geofencing, IA para presupuestos por imagen, rutas optimizadas, control de asistencia y jornada.
