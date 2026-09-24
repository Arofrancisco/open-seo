---
name: amazon-ai-search-readiness
description: "Audits an Amazon listing for how well AI shopping assistants (Rufus in the US/EU, Alexa voice shopping in the US) can find, understand and recommend it — not just how it ranks in classic keyword search."
---

# Preparar una ficha para Rufus y Alexa

## Objetivo
Rufus y Alexa no leen tu ficha como un buscador de palabras clave: la resumen,
la comparan con otras y responden en lenguaje natural. Esta skill audita si tu
ficha tiene lo necesario para que un asistente de IA la entienda bien y te
recomiende, en vez de recomendar a tu competidor.

## Por qué es distinto del SEO de Amazon clásico
- El SEO clásico optimiza para el ALGORITMO DE BÚSQUEDA (A9/A10): coincidencia
  de palabras clave, conversión, velocidad de venta.
- Esto optimiza para el MODELO DE IA que LEE tu ficha para responder una
  pregunta ("¿qué crema va bien para piel con acné?") o para decidir qué
  producto recomendar en voz alta. Le importa que el contenido sea claro,
  completo y responda dudas reales — no que repita la keyword muchas veces.

## Qué mira Rufus (asistente conversacional, EE.UU. y en expansión a Europa)
Rufus construye su respuesta a partir de:
1. **Título y descripción** — lenguaje natural (qué es, para qué, para quién),
   no solo palabras clave encadenadas. Cuanto más descriptivo y concreto, mejor
   lo entiende.
2. **Bullets** — cada uno responde una pregunta real de cliente, no solo
   enumera características.
3. **Preguntas y Respuestas / FAQ (Q&A)** — una de las fuentes que más usa
   Rufus para responder dudas concretas. Sin preguntas reales sembradas, la
   ficha queda "muda" para este tipo de consulta.
4. **Reseñas** — el contenido, no solo la nota media: qué casos de uso
   mencionan los clientes.
5. **A+ Content / Contenido de marca mejorado** — cuadros comparativos,
   tablas de ingredientes o tallas.
6. **Imágenes** — Rufus es multimodal: lee texto DENTRO de las imágenes
   (infografías con modo de uso, tabla de tallas, ingredientes en la propia
   foto), no solo el texto de la ficha. Una imagen sin texto útil es una
   oportunidad perdida de información para la IA.
7. **Metadatos y atributos backend** (Seller Central: dimensiones, material,
   compatibilidad, términos de búsqueda ocultos) — campos que no se ven en la
   ficha pero que Rufus usa para responder preguntas muy específicas.

## Qué mira Alexa (compra por voz, EE.UU.)
Alexa lee UNA opción en voz alta — no hay lista para comparar visualmente:
1. **Ganar la Buy Box / oferta destacada** es crítico: si no eres la oferta
   principal, es muy difícil que Alexa te lea a ti.
2. **Ser Prime y tener buena valoración** — Alexa prioriza fiabilidad, no
   creatividad de marketing.
3. **Historial de compra del cliente** — para "vuelve a pedir X", Alexa tira
   primero de lo que ese cliente ya compró antes. Si vendes recurrente
   (consumibles), que el cliente active "Suscríbete y ahorra" ayuda a que
   Alexa te recuerde.
4. **Título simple y locutable** — un título que suene bien leído en voz alta,
   no un amasijo de keywords.

## Workflow
1. Pide el ASIN o el enlace de la ficha a auditar (y el marketplace: España,
   EE.UU., etc. — Rufus en Europa está en expansión, así que anota si el país
   ya lo tiene disponible).
2. Revisa título, bullets, descripción, A+ Content y atributos técnicos:
   ¿responden preguntas reales de cliente, o solo listan características?
3. Revisa la sección de preguntas y respuestas: ¿hay preguntas reales
   sembradas, o está vacía?
4. Revisa una muestra de reseñas recientes: ¿qué preguntas o casos de uso
   reales mencionan los clientes que la ficha no responde todavía?
5. Revisa las imágenes: ¿alguna trae texto útil (modo de uso, tallas,
   ingredientes) que un modelo multimodal pueda leer?
6. Si vendes en EE.UU.: comprueba quién tiene la Buy Box y si el producto es
   apto para "Suscríbete y ahorra".
7. Con todo eso, entrega un listado corto y accionable (ver formato).

## Output format
Una tabla con: elemento revisado · estado (bien / falta / mejorable) ·
acción concreta a hacer. Al final, UNA sola acción prioritaria de esta semana
— no una lista larga sin orden.

## Guardrails
- No inventar datos de Rufus/Alexa que no estén contrastados; si algo es
  incierto (ej. disponibilidad de Rufus en un país concreto), decirlo así.
- No prometer resultados de posicionamiento — esto es preparar la ficha para
  que la IA la entienda mejor, no garantizar que la recomiende.
- No sugerir reseñas falsas ni Q&A fabricadas por el vendedor sin avisar que
  incumple política de Amazon: las preguntas sembradas deben ser reales o de
  clientes reales, nunca simuladas para parecer clientes.
