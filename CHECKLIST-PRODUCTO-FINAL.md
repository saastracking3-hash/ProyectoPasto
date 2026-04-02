# The Green Side - Checklist: de MVP a App Completa y Funcional

## Estado actual
- ✅ UI completa con datos placeholder (30 paginas, 4 portales)
- ✅ Supabase conectado (proyecto activo, 17 tablas, 8 tipos de servicio, RLS)
- ✅ Auth funcionando (registro + login reales)
- ✅ 1 usuario de prueba creado (cliente@thegreenside.com)
- ❌ Paginas muestran datos ficticios (no conectadas a Supabase)
- ❌ No se pueden crear servicios reales todavia

---

## FASE 1 - CONECTAR PORTAL CLIENTE A DATOS REALES
> El cliente puede pedir, ver y gestionar servicios de verdad

### 1.1 Dashboard conectado
- [ ] Cargar nombre del usuario logueado desde profiles
- [ ] Contar servicios activos reales (query service_requests WHERE status NOT IN closed/cancelled)
- [ ] Contar presupuestos pendientes reales
- [ ] Contar servicios completados reales
- [ ] Lista de servicios recientes reales (ultimos 5)

### 1.2 Solicitar servicio (flujo completo)
- [ ] Paso 1: Cargar tipos de servicio desde tabla service_types (no hardcodeados)
- [ ] Paso 2: Cargar direcciones guardadas del cliente desde tabla addresses
- [ ] Paso 2: Formulario para agregar nueva direccion -> INSERT en addresses
- [ ] Paso 3: Guardar descripcion, fecha preferida, franja horaria, area estimada, urgencia
- [ ] Paso 4: Subir fotos del terreno a Supabase Storage -> guardar URLs
- [ ] Paso 5: Confirmar y crear solicitud -> INSERT en service_requests + INSERT en service_state_log
- [ ] Validacion con Zod en cada paso
- [ ] Redirect a /servicios/[id] despues de crear

### 1.3 Mis servicios
- [ ] Lista real desde service_requests WHERE client_id = usuario actual
- [ ] JOIN con service_types para mostrar nombre del servicio
- [ ] JOIN con addresses para mostrar direccion
- [ ] Filtros por estado funcionando contra la DB
- [ ] Paginacion o infinite scroll

### 1.4 Detalle de servicio
- [ ] Cargar servicio completo con JOINs (type, address, quote, assignment)
- [ ] Timeline real desde service_state_log ORDER BY created_at
- [ ] Mostrar presupuesto si existe (JOIN quotes + quote_items)
- [ ] Mostrar asignacion si existe (JOIN assignments + crews)
- [ ] Mostrar fotos reales desde service_photos
- [ ] Boton aprobar/rechazar presupuesto funcional

### 1.5 Presupuestos
- [ ] Lista real de presupuestos del cliente (JOIN quotes -> service_requests -> client_id)
- [ ] Detalle con line items reales desde quote_items
- [ ] Aprobar: UPDATE quote status='approved' + UPDATE service_request status='approved' + INSERT state_log
- [ ] Rechazar: UPDATE quote status='rejected' + campo rejection_reason + INSERT state_log

### 1.6 Calificacion
- [ ] Formulario de review -> INSERT en reviews
- [ ] Solo disponible cuando servicio esta en estado "closed"
- [ ] Mostrar review existente si ya califico

### 1.7 Perfil
- [ ] Cargar datos del perfil desde profiles
- [ ] Actualizar nombre/telefono -> UPDATE profiles
- [ ] CRUD de direcciones (agregar, editar, eliminar, marcar default)
- [ ] Cambio de contraseña con supabase.auth.updateUser()

---

## FASE 2 - CONECTAR ADMIN BACKOFFICE A DATOS REALES
> La empresa puede gestionar toda la operacion

### 2.1 Dashboard admin
- [ ] KPIs reales: COUNT solicitudes hoy, presupuestos pendientes, servicios activos, cuadrillas en campo
- [ ] Actividad reciente desde service_state_log con JOINs
- [ ] Alertas: solicitudes sin revisar hace mas de X horas

### 2.2 Solicitudes
- [ ] Tabla con datos reales + busqueda por nombre/numero + filtro por estado
- [ ] Detalle: info completa del cliente, fotos, historial
- [ ] Boton "Marcar en revision" -> UPDATE status + INSERT state_log
- [ ] Campo notas internas -> UPDATE service_requests.internal_notes

### 2.3 Crear presupuesto
- [ ] Crear presupuesto nuevo: INSERT quotes con status='draft'
- [ ] Editor de line items: INSERT/UPDATE/DELETE quote_items
- [ ] Calcular totales automaticamente (labor + materials = total)
- [ ] Guardar borrador
- [ ] Enviar al cliente: UPDATE quote status='sent' + UPDATE service_request status='pending_approval' + INSERT state_log
- [ ] Fecha de vigencia (valid_until)

### 2.4 Cuadrillas
- [ ] CRUD de cuadrillas: INSERT/UPDATE crews
- [ ] Agregar/quitar miembros: INSERT/DELETE crew_members
- [ ] Ver disponibilidad (no tener asignaciones en el mismo horario)
- [ ] Historial de trabajos por cuadrilla
- [ ] Stats: trabajos completados, calificacion promedio

### 2.5 Asignacion
- [ ] Seleccionar cuadrilla para un servicio aprobado
- [ ] Elegir fecha y horario
- [ ] Verificar conflictos de agenda
- [ ] INSERT en assignments + UPDATE service_request status='crew_assigned' + INSERT state_log
- [ ] Crear checklist automatico desde template del tipo de servicio

### 2.6 Agenda
- [ ] Calendario real desde assignments JOIN service_requests JOIN crews
- [ ] Vista dia/semana
- [ ] Drag & drop para reprogramar (UPDATE scheduled_date)
- [ ] Filtrar por cuadrilla/zona

### 2.7 Vista completa de servicio
- [ ] Todo el ciclo de vida en una sola pantalla
- [ ] Acciones admin segun estado actual (validar, cerrar, cancelar, reabrir)
- [ ] Timeline completo con quien hizo cada cambio

### 2.8 Configuracion
- [ ] CRUD tipos de servicio (INSERT/UPDATE/DELETE service_types)
- [ ] CRUD plantillas de checklist (INSERT/UPDATE/DELETE checklist_templates + items)
- [ ] Editar precios base

---

## FASE 3 - CONECTAR PORTAL CUADRILLAS A DATOS REALES
> El equipo ejecuta en la calle con datos reales

### 3.1 Trabajos del dia
- [ ] Query assignments WHERE crew_id IN (mis cuadrillas) AND scheduled_date = hoy
- [ ] JOIN con service_requests, service_types, addresses, profiles (cliente)
- [ ] Ordenar por horario

### 3.2 Detalle de trabajo
- [ ] Cargar toda la info del servicio con JOINs
- [ ] Telefono del cliente clickeable (tel:)
- [ ] Boton navegar abre Google Maps con lat/lng real

### 3.3 Progresion de estados (botones funcionales)
- [ ] "Salir hacia el lugar" -> UPDATE status='in_transit' + INSERT state_log
- [ ] "Ya llegue" -> UPDATE status='arrived' + INSERT state_log
- [ ] "Empezar trabajo" -> UPDATE status='in_progress' + actual_start_at=now() + INSERT state_log
- [ ] "Pausar" / "Reanudar" -> UPDATE status + INSERT state_log
- [ ] "Trabajo terminado" -> UPDATE status='completed_by_crew' + actual_end_at=now() + INSERT state_log
- [ ] Validar transiciones con state-machine.ts (no saltear pasos)
- [ ] No permitir cerrar si checklist obligatorio incompleto

### 3.4 Checklist funcional
- [ ] Cargar checklist del assignment desde tabla checklists + checklist_items
- [ ] Toggle checkbox -> UPDATE checklist_items (completed, completed_at, completed_by)
- [ ] Guardar notas por item
- [ ] Barra de progreso real

### 3.5 Fotos reales
- [ ] Subir fotos a Supabase Storage (bucket 'service-photos')
- [ ] Comprimir imagen client-side antes de subir
- [ ] Clasificar como before/during/after
- [ ] INSERT en service_photos con storage_path
- [ ] Mostrar fotos existentes del servicio
- [ ] Captura desde camara del celular (capture="environment")

### 3.6 Materiales
- [ ] Formulario para registrar materiales usados -> INSERT materials_log
- [ ] Lista de materiales ya cargados para este servicio
- [ ] Editar/eliminar materiales

### 3.7 Modo offline
- [ ] Detectar cuando no hay conexion
- [ ] Guardar cambios pendientes en localStorage
- [ ] Sincronizar cuando vuelve internet
- [ ] Indicador visual de estado de conexion
- [ ] Cola de fotos pendientes de subir

---

## FASE 4 - REALTIME Y NOTIFICACIONES
> Todos ven los cambios en tiempo real

### 4.1 Supabase Realtime
- [ ] Cliente: suscripcion a cambios en sus service_requests (status changes en vivo)
- [ ] Admin: suscripcion a nuevas solicitudes (aparecen en la tabla sin refrescar)
- [ ] Admin: mapa/lista de cuadrillas con estado actualizado en vivo
- [ ] Cuadrilla: notificacion si le asignan un nuevo trabajo

### 4.2 Notificaciones al cliente
- [ ] Solicitud recibida (al crear)
- [ ] Presupuesto disponible (al enviar quote)
- [ ] Equipo en camino (status -> in_transit)
- [ ] Equipo llego (status -> arrived)
- [ ] Trabajo finalizado (status -> completed_by_crew)
- [ ] Servicio cerrado (status -> closed)
- [ ] Recordatorio de proximo mantenimiento (si tiene plan)

### 4.3 Notificaciones internas
- [ ] Nueva solicitud (para admin)
- [ ] Cliente aprobo/rechazo presupuesto (para admin)
- [ ] Cuadrilla termino trabajo - pendiente validacion (para admin/supervisor)
- [ ] Calificacion baja recibida (para supervisor)
- [ ] Trabajo asignado (para cuadrilla)

### 4.4 Canales de notificacion
- [ ] Push notifications (web + mobile)
- [ ] Email transaccional (Supabase Edge Functions o servicio externo)
- [ ] WhatsApp Business API para mensajes al cliente
- [ ] SMS para urgencias (opcional)

---

## FASE 5 - LANDING PAGE COMPLETA Y SEO
> El sitio web que vende

### 5.1 Secciones faltantes
- [ ] Galeria Antes/Despues con slider interactivo (fotos reales de trabajos)
- [ ] Planes de mantenimiento con precios reales y boton de contratacion
- [ ] Testimonios reales de clientes (desde tabla reviews)
- [ ] Mapa de cobertura interactivo (CABA, Zona Norte, Zona Oeste)
- [ ] Formulario de contacto -> envio a WhatsApp o email
- [ ] FAQ con preguntas reales

### 5.2 SEO y Performance
- [ ] Meta tags completos (title, description, OG, Twitter Cards)
- [ ] Schema.org markup (LocalBusiness)
- [ ] Sitemap.xml dinamico
- [ ] robots.txt
- [ ] Google Analytics 4
- [ ] Meta Pixel (para campañas de Meta Ads)
- [ ] Optimizar imagenes (WebP, lazy loading, next/image)
- [ ] PageSpeed > 90 en mobile

### 5.3 Dominio y deploy
- [ ] Comprar dominio (thegreenside.com.ar)
- [ ] Deploy en Vercel
- [ ] Configurar DNS
- [ ] SSL (automatico con Vercel)
- [ ] Configurar Supabase URL personalizada (opcional)

---

## FASE 6 - GESTION FINANCIERA
> Facturacion, pagos y costos

### 6.1 Pagos
- [ ] Registrar pagos manuales (transferencia, efectivo, QR)
- [ ] Integracion con Mercado Pago (links de pago)
- [ ] Marcar servicio como pagado
- [ ] Historial de pagos por cliente
- [ ] Saldo pendiente por cliente

### 6.2 Facturacion
- [ ] Generar comprobante/factura PDF
- [ ] Separar mano de obra vs materiales en factura
- [ ] Numeracion correlativa
- [ ] Datos fiscales del cliente
- [ ] Envio de factura por email

### 6.3 Costos y rentabilidad
- [ ] Costo real por servicio (mano de obra + materiales + traslado)
- [ ] Comparar cotizado vs real
- [ ] Margen de ganancia por servicio
- [ ] Costo por cuadrilla/operario

---

## FASE 7 - PLANES RECURRENTES Y CONTRATOS
> Ingresos estables y operacion predecible

### 7.1 Planes de mantenimiento
- [ ] Crear planes (semanal, quincenal, mensual, personalizado)
- [ ] Definir tareas incluidas, frecuencia, precio
- [ ] Generacion automatica de servicios futuros segun frecuencia
- [ ] Cliente puede ver/modificar/cancelar su plan
- [ ] Facturacion recurrente automatica

### 7.2 Contratos corporativos
- [ ] Modulo de contratos por periodo con SLA
- [ ] Multiples ubicaciones por cliente corporativo
- [ ] Responsables autorizantes por ubicacion
- [ ] Reportes mensuales automaticos para corporativos
- [ ] Topes de gasto con alertas
- [ ] Facturacion centralizada

---

## FASE 8 - REPORTES Y ANALITICA
> Medir para mejorar

### 8.1 Dashboard de direccion
- [ ] Ingresos por periodo (dia/semana/mes/año)
- [ ] Servicios por periodo con tendencia
- [ ] Tasa de conversion (solicitudes -> servicios cerrados)
- [ ] Ticket promedio
- [ ] Clientes activos vs nuevos vs perdidos

### 8.2 Reportes operativos
- [ ] Ocupacion de cuadrillas (% tiempo productivo)
- [ ] Tiempo promedio por tipo de servicio
- [ ] Cumplimiento horario (llegaron a tiempo?)
- [ ] Retrabajos y reclamos
- [ ] Productividad por zona

### 8.3 Reportes por cuadrilla/operario
- [ ] Trabajos completados
- [ ] Calificacion promedio
- [ ] Tiempos reales vs estimados
- [ ] Materiales consumidos
- [ ] Incidentes reportados

### 8.4 Reportes de clientes
- [ ] Rentabilidad por cliente
- [ ] Frecuencia de contratacion
- [ ] Historial completo
- [ ] Clientes en riesgo de perdida (baja actividad)

### 8.5 Exportacion
- [ ] Exportar cualquier reporte a CSV/Excel
- [ ] Reportes PDF para clientes corporativos
- [ ] Envio automatico de reportes por email

---

## FASE 9 - FUNCIONALIDADES AVANZADAS
> Lo que los diferencia de la competencia

### 9.1 Cotizacion inteligente
- [ ] Cotizacion automatica para trabajos simples (superficie x tipo x zona = precio)
- [ ] Motor de reglas configurable
- [ ] Historial de precios para ajustar
- [ ] IA para estimar por foto del terreno (futuro)

### 9.2 Clima y reprogramacion
- [ ] Consulta meteorologica automatica (API clima)
- [ ] Alertas por lluvia para el dia siguiente
- [ ] Sugerencia de reprogramacion masiva
- [ ] Notificacion automatica al cliente si se reprograma
- [ ] Prioridades automaticas post-lluvia

### 9.3 Geolocalizacion avanzada
- [ ] Mapa en vivo con cuadrillas activas (admin)
- [ ] ETA estimado para el cliente
- [ ] Optimizacion de rutas por cercania (agrupar trabajos)
- [ ] Geofencing: auto check-in al llegar al lugar
- [ ] Tracking de tiempo en ruta vs en trabajo

### 9.4 Inventario de herramientas
- [ ] Registro de herramientas y maquinaria
- [ ] Asignacion por cuadrilla/servicio
- [ ] Control de mantenimiento preventivo
- [ ] Alertas de mantenimiento vencido
- [ ] Bloqueo de conflictos de uso (no asignar la misma herramienta a dos cuadrillas)

### 9.5 Gestion de personal
- [ ] Control de asistencia y jornada
- [ ] Habilidades por operario
- [ ] Capacitaciones realizadas
- [ ] Historial laboral
- [ ] Calificacion interna

### 9.6 Comunicacion avanzada
- [ ] Chat interno entre admin y cuadrillas
- [ ] Chat con el cliente (por servicio)
- [ ] WhatsApp automatizado (confirmaciones, recordatorios)
- [ ] Plantillas de mensajes configurables

---

## FASE 10 - MOBILE NATIVO (React Native)
> Apps reales en los stores

### 10.1 App Cliente (iOS + Android)
- [ ] Setup Expo/React Native
- [ ] Compartir tipos y logica con el proyecto web
- [ ] Todas las pantallas del portal cliente adaptadas a nativo
- [ ] Push notifications nativas
- [ ] Camara nativa para fotos
- [ ] Publicar en App Store y Google Play

### 10.2 App Cuadrillas (iOS + Android)
- [ ] Todas las pantallas del portal crew adaptadas a nativo
- [ ] GPS nativo para tracking
- [ ] Modo offline robusto con SQLite local
- [ ] Camara nativa con compresion
- [ ] Push notifications para nuevas asignaciones
- [ ] Publicar en stores

---

## ORDEN RECOMENDADO DE EJECUCION

| Prioridad | Fase | Estimacion | Resultado |
|-----------|------|-----------|-----------|
| 🔴 Critica | Fase 1 - Cliente conectado | 1-2 semanas | Cliente puede pedir servicio real |
| 🔴 Critica | Fase 2 - Admin conectado | 1-2 semanas | Empresa puede gestionar |
| 🔴 Critica | Fase 3 - Cuadrillas conectado | 1 semana | Equipo ejecuta en campo |
| 🟡 Alta | Fase 4 - Realtime + notificaciones | 1 semana | Experiencia fluida |
| 🟡 Alta | Fase 5 - Landing + SEO + deploy | 1 semana | Presencia online real |
| 🟡 Alta | Fase 6 - Facturacion y pagos | 1-2 semanas | Cobrar por servicios |
| 🟢 Media | Fase 7 - Planes recurrentes | 1 semana | Ingresos estables |
| 🟢 Media | Fase 8 - Reportes | 1-2 semanas | Medir operacion |
| 🔵 Baja | Fase 9 - Funcionalidades avanzadas | 2-4 semanas | Diferenciacion |
| 🔵 Baja | Fase 10 - Mobile nativo | 3-4 semanas | Apps en stores |

---

**Con Fases 1-3 completas:** pueden operar de verdad (pedir -> gestionar -> ejecutar -> cerrar)
**Con Fases 1-6 completas:** negocio funcional completo (operar + cobrar + presencia web)
**Con Fases 1-10 completas:** producto final como describe el documento de producto
