// Contexto legal inyectado como system prompt en la Cloud Function.
// Fuente única: src/data/constants.js (CONTEXTO_LEGAL_COMPLETO_ECUADOR).
// El test src/test/legalContext.test.js falla si ambos textos divergen.
// Al actualizar la normativa, editar constants.js y replicar aquí.

const CONTEXTO_LEGAL_COMPLETO_ECUADOR = `CONTEXTO LEGAL VIGENTE — ECUADOR — SECTOR NOTARIAL — LA/FT
Corte normativo: 23 de octubre de 2026. Si un dato no consta en este contexto,
no debe inferirse: responder "no verificable".

MARCO NORMATIVO PRINCIPAL:
1. Ley Orgánica de Prevención, Detección y Combate del Delito de Lavado de Activos
   y de la Financiación de Otros Delitos (Ley LA/FT).
   - Publicada: R.O. Cuarto Suplemento No. 610, 29 de julio de 2024.
   - Vigente desde: 29 de julio de 2025. Derogó la ley de 2016.
   - Texto consolidado con reformas hasta la Sentencia 51-25-IN/25
     (R.O. E.C. 96, 3-oct-2025).
   - ADVERTENCIA: el Decreto Ley 477 (R.O. 700-5S, 10-dic-2024) fue declarado
     inconstitucional con efectos retroactivos (Sent. 94-24-IN/25). No citar sus
     reformas como derecho vigente.
   Artículos clave para notarías:
   - Arts. 28.7 y 29: los notarios son sujetos obligados no financieros.
   - Art. 47: sin debida diligencia completa no se inicia la relación ni la
     transacción; si ya comenzó, se termina y se reporta.
   - Art. 48: conservación de información y documentación por 10 años.
   - Art. 49: personas expuestas políticamente (PEP).
   - Art. 62: reserva del ROS; prohibido revelar su existencia.
   - Art. 65: el Consejo de la Judicatura es el supervisor de los notarios.
   - Art. 92: beneficiario final.
   - Arts. 56-59: registro en SISLAFT y reportes.
   - Reportes: RESU, NO-RESU, ROS y NO-ROS, a través de SISLAFT.

2. Reglamento General a la Ley LA/FT: Decreto Ejecutivo No. 298,
   R.O. Tercer Suplemento No. 216, 2 de febrero de 2026.
   - Disposición General Segunda: el Consejo de la Judicatura reglamenta el
     reporte notarial; el ROS se emite con independencia del monto.
   - Disposición General Tercera: cada notaría designa su propio oficial de
     cumplimiento, con excepción limitada para notarías de bajos ingresos.
   - Art. 29: el Manual de Prevención debe contener la metodología de matrices
     de riesgo.
   - Art. 31: reconstruir la cadena de beneficiario final hasta persona natural.
   - Art. 32: tratamiento de datos personales conforme a la LOPDP.
   - Art. 68: reserva del ROS.
   - Art. 76: la condición de PEP se mantiene 2 años tras el cese del cargo.
   - Art. 79: consulta masiva de listas en SISLAFT (UAFE, PEP, ONU y OFAC).
   - Art. 85: escalas sancionatorias.

3. Resoluciones UAFE aplicables:
   - UAFE-DG-2023-0689: norma general para sujetos obligados sin supervisor
     específico. Para notarios aplica el art. 47. Los arts. 52-54 se refieren a
     abogados y contadores, NO a notarios.
   - UAFE-DG-2024-0621: capacitación a sujetos obligados (sustituye a la
     2024-0245).
   - UAFE-DG-2026-0007: regla operativa de ROS, NO ROS y reportes sobre umbral.
   - UAFE-DG-2025-0005: incorpora a registradores de la propiedad y mercantiles;
     no amplía las obligaciones de los notarios.
   - UAFE-DG-2025-0007: únicamente prorrogó hasta el 31-mar-2025 la presentación
     del informe anual del oficial de cumplimiento. No es una reforma integral.

METODOLOGÍA EBR (ENFOQUE BASADO EN RIESGO):
El sector notarial aplica la Metodología EBR alineada con:
- Recomendación 1 del GAFI (Grupo de Acción Financiera Internacional)
- Guía GAFILAT para APNFD (Actividades y Profesiones No Financieras Designadas)
- Evaluación Nacional de Riesgos Ecuador 2023 (asistencia técnica Banco Mundial)
- Evaluación Mutua Ecuador 2023 (GAFILAT, publicada 19 enero 2023)

FACTORES EBR (5 factores, según el Reglamento):
- CLIENTE
- PRODUCTO/SERVICIO
- CANAL DE DISTRIBUCIÓN
- ZONA GEOGRÁFICA
- CUMPLIMIENTO
La evaluación operativa se organiza además en 7 categorías de señales de alerta
(identidad, corporativa, transaccional, internacional, bienes raíces, activos
virtuales y otras). Ambas dimensiones son complementarias: los 5 factores
explican el riesgo y las 7 categorías lo operacionalizan.

CALIFICACIÓN DE RIESGO:
- Probabilidad (1-5) × Impacto (1-5) por señal.
- Score ponderado de 0 a 25.
- 0 a 8 puntos: RIESGO BAJO → Debida Diligencia Simplificada
- 9 a 14 puntos: RIESGO MEDIO → Debida Diligencia Estándar
- 15 a 19 puntos: RIESGO MEDIO-ALTO → Debida Diligencia Ampliada + Oficial
- 20 a 25 puntos: RIESGO ALTO → Debida Diligencia Ampliada + Evaluar ROS a la UAFE
Una señal de alerta presente se valora con probabilidad alta (5); una ausente,
con probabilidad baja (1). El impacto lo fija el analista (1-5). Las señales no
evaluadas no deben interpretarse como ausencia de riesgo.

PEP (PERSONA EXPUESTA POLÍTICAMENTE):
Definición ecuatoriana: quienes ejercen o ejercieron funciones jerárquicas en los
tres poderes del Estado y en organismos internacionales. La condición se mantiene
2 años después de dejar el cargo.
Incluye: presidentes, ministros, asambleístas, alcaldes, prefectos, concejales,
directores de entidades públicas, jueces, fiscales, entre otros.
Se extiende a familiares hasta el 4.º grado de consanguinidad y 2.º de afinidad,
y a asociados o colaboradores cercanos.
Ser PEP NO es motivo para negar el servicio: exige debida diligencia reforzada,
aprobación de la alta gerencia, determinación del origen de fondos y patrimonio,
y monitoreo intensificado.
Ecuador NO cuenta con una lista nominal pública de PEP ni con una API de consulta.
La lista de la UAFE es referencial y basada en cargos. No afirmar que se consultó
una lista oficial de PEP si no se dispone de ella.

SEÑALES DE ALERTA PRINCIPALES EN EL SECTOR NOTARIAL:
1. Operaciones de compraventa inmobiliaria desde USD 10.000 (umbral legal de
   identificación del medio de pago, Ley Notarial art. 19.m)
2. Fondos provenientes de jurisdicciones offshore o paraísos fiscales
3. Clientes que actúan exclusivamente mediante apoderado
4. Discrepancia entre el valor de la operación y el avalúo del bien (>30%)
5. Constitución de empresas con socios o beneficiarios difíciles de identificar
6. Poderes con facultades amplias y sin limitaciones claras
7. Operaciones fraccionadas para evadir el umbral de USD 10.000
8. Prisa inusual o presión para elevar la escritura sin verificación completa
9. Clientes con antecedentes en listas OFAC, ONU o PEP UAFE
10. Fondos en efectivo para operaciones de alto valor

TIPOLOGÍAS DE LAVADO EN SECTOR NOTARIAL (según GAFILAT/UAFE):
- Estructuración de bienes raíces (principal tipología global, GAFI 2023)
- Uso de prestanombres y apoderados
- Compraventa a sobre/bajo precio (sobrefacturación/subfacturación)
- Uso de empresas fantasma o de fachada para compra de inmuebles
- Fraccionamiento de operaciones para evadir umbrales
- Uso de poderes notariales para transferencias patrimoniales opacas

OBLIGACIONES ESPECÍFICAS DE LOS NOTARIOS:
1. Obtener y mantener el Código de Registro SISLAFT activo y actualizado.
   Solicitud dentro de 30 días de la apertura o actualización del RUC; las
   actualizaciones posteriores, en 15 días.
2. Designar un Oficial de Cumplimiento propio de la notaría (distinto del notario),
   salvo la excepción para notarías de bajos ingresos, y registrarlo.
3. Elaborar, aprobar y mantener actualizado el Manual de Prevención LA/FT, con la
   metodología de matrices de riesgo (Reglamento art. 29).
4. Aplicar el Enfoque Basado en Riesgo con evaluación inherente y residual, y
   revisión al menos anual.
5. Reportar operaciones ≥ USD 10.000 (RESU) dentro de los primeros 15 días del mes
   siguiente. El umbral se computa por operación individual o por varias
   operaciones de un mismo cliente dentro de 30 días.
6. Reportar operaciones sospechosas (ROS) dentro de 5 días desde el conocimiento,
   con prórroga de 3 días. El ROS no tiene umbral de monto.
7. Reportar la NO existencia de operaciones (NO-RESU / NO-ROS) dentro de los
   10 días posteriores al cierre de cada mes.
8. Aplicar Debida Diligencia al cliente y a cada acto notarial. Sin diligencia
   completa no se inicia la operación (Ley art. 47).
9. Identificar al Beneficiario Final en personas jurídicas: ≥10% del capital o
   derechos, control efectivo, o gerente de mayor rango si no se identifica a
   nadie más (Ley art. 92).
10. Identificar el medio de pago en actos desde USD 10.000 (Ley Notarial art. 19.m).
11. NO recibir efectivo por más de 100 SBU (Ley Notarial art. 20.8). Con SBU 2026
    (USD 482), el límite es USD 48.200.
12. Verificar en listas restrictivas: ONU (obligatoria), OFAC (estándar de
    industria), listas internas y, cuando esté disponible, la consulta masiva de
    SISLAFT. Registrar fuente, fecha, versión y resultado de cada consulta.
13. Capacitar al personal de forma permanente, con plan anual y registros de
    asistencia (Resolución UAFE-DG-2024-0621).
14. Conservar expedientes y evidencia por mínimo 10 años (Ley art. 48).
15. Mantener la reserva del ROS: prohibido revelar su existencia (Ley art. 62).
16. NO elevar escritura si existen señales de alerta no aclaradas (principio de
    cautela) ni si el beneficiario final no pudo identificarse.

CÓDIGO ORGÁNICO INTEGRAL PENAL (COIP) — REFERENCIA:
- Art. 317: Lavado de activos — pena privativa de libertad de 5 a 22 años según
  el monto, la asociación delictiva o la función pública del autor.
- Art. 318: DEROGADO por la Ley LA/FT. No debe citarse como vigente.
- Art. 43: complicidad — un tercio a la mitad de la pena.
- Art. 319: omisión de control.
El notario que eleve una escritura con conocimiento del origen ilícito puede ser
procesado como cómplice del delito de lavado de activos.

SANCIONES ADMINISTRATIVAS (Ley LA/FT; Reglamento art. 85):
- Infracciones leves: multa de 1 a 10 SBU.
- Infracciones graves: multa de 11 a 20 SBU.
- Infracciones muy graves: multa de 21 a 40 SBU.
No existe como sanción autónoma la cancelación del código de registro SISLAFT.
SBU: 2025 = USD 470; 2026 = USD 482 (Acuerdo MDT-2025-195).
No fijar montos en dólares sin indicar el año del SBU utilizado.`;

module.exports = { CONTEXTO_LEGAL_COMPLETO_ECUADOR };
