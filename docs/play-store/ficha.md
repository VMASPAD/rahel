# Ficha de Play Store · RaHel

Textos listos para pegar en Play Console (Presencia en Play Store > Ficha de Play Store principal). Los límites de caracteres están verificados. Lo que va entre `[corchetes]` lo tienes que completar tú.

Para el resto del proceso (firma, formularios, permisos, pruebas) ver [../play-store.md](../play-store.md).

---

## Datos generales

| Campo | Valor |
|---|---|
| Nombre de la app (≤ 30) | `RaHel` |
| Paquete | `xyz.targapps.rahel` |
| Tipo | App (no juego) |
| Precio | Gratis, sin compras ni anuncios |
| Dispositivo | **Wear OS** (relojes con Wear OS 3 o superior, Android 11+) |
| Categoría | Salud y bienestar |
| Etiquetas sugeridas | Salud y bienestar · Seguimiento de actividad · Wear OS |
| Idioma predeterminado | Español (Latinoamérica) `es-419`; traducción al inglés `en-US` |
| Correo de contacto (obligatorio) | `[correo público de soporte]` |
| Sitio web | `https://rahel.hermesbackend.xyz` |
| Política de privacidad (obligatoria) | `[URL pública HTTPS]`: publicar el contenido de [../privacy-policy.md](../privacy-policy.md) |

---

## Español (es-419)

### Descripción breve (≤ 80)

```
Signos vitales de tu reloj Wear OS, en tu muñeca y en un panel web.
```

*(67 caracteres)*

Alternativas:
- `Lee tus signos vitales desde el reloj y sigue la evolución en el panel.` (71)
- `El pulso de cada persona, del reloj al panel. Para Wear OS.` (59)

### Descripción completa (≤ 4000)

```
RaHel convierte tu reloj Wear OS en un monitor de signos vitales y envía los datos, de forma segura, a un panel web donde tú o tu equipo ven cómo evoluciona cada persona.

QUÉ HACE
• Mide el pulso (frecuencia cardíaca) y los pasos del día desde los sensores del reloj.
• Calcula una evaluación de bienestar en el propio reloj y la muestra en pantalla.
• Sigue funcionando con la pantalla apagada gracias a un servicio de salud en primer plano, con una notificación visible mientras está activo.
• Si no hay conexión, guarda las muestras en el reloj y las envía cuando vuelve la red, sin duplicar lecturas.
• Todo se vincula con un código de un solo uso: abres RaHel en el reloj, escribes el código en el panel web y empiezas a ver los datos.

LO MEDIDO Y LO ESTIMADO, SEPARADOS
RaHel no inventa datos. Lo que el reloj mide se muestra tal cual. Lo que el reloj no mide (variabilidad cardíaca, pulso en reposo, sueño y estrés) se estima a partir de tu historial de pulso y pasos, y se marca siempre como "estimado" con su nivel de confianza. La temperatura de la piel no se estima: solo se mostrará si tu reloj la entrega.

EL PANEL WEB
• Ve la última lectura y el historial de cada reloj vinculado.
• Analítica de sensores: qué campos llegan, con qué cobertura, cuáles son medidos o estimados y qué sensores detecta tu reloj, para decidir cuáles conservar.
• Cada cuenta solo ve los relojes que ella misma vinculó, y puedes desvincular un reloj cuando quieras.

PRIVACIDAD Y SEGURIDAD
• Los datos viajan cifrados (HTTPS).
• Los códigos de vinculación caducan y tienen límite de intentos.
• No hay anuncios ni venta de datos.
• Puedes pedir la eliminación de tus datos en cualquier momento: [correo de soporte].

IMPORTANTE
RaHel no es un dispositivo médico y no diagnostica ni trata ninguna enfermedad. La información que muestra es orientativa y no sustituye la valoración de un profesional de la salud. Ante cualquier síntoma o emergencia, consulta a un profesional o llama a tu servicio de emergencias.

REQUISITOS
• Reloj con Wear OS 3 o superior (Android 11 o más reciente).
• Para ver los datos en el panel: una cuenta en https://rahel.hermesbackend.xyz y conexión a internet en el reloj.
• Los sensores disponibles dependen de cada modelo de reloj.
```

### Notas de la versión (≤ 500) · 1.0.0

```
Primera versión de RaHel.
• Medición de pulso y pasos desde el reloj.
• Evaluación de bienestar en pantalla.
• Envío seguro al panel web con vinculación por código.
• Funciona sin conexión y reenvía al volver la red.
```

---

## English (en-US)

### Short description (≤ 80)

```
Vital signs from your Wear OS watch, on your wrist and in a web dashboard.
```

*(74 characters)*

### Full description (≤ 4000)

```
RaHel turns your Wear OS watch into a vital-signs monitor and securely sends the data to a web dashboard where you or your team can follow how each person is doing.

WHAT IT DOES
• Measures heart rate and daily steps from your watch sensors.
• Calculates a wellbeing assessment on the watch itself and shows it on screen.
• Keeps working with the screen off through a foreground health service, with a visible notification while it is active.
• If there is no connection, it stores samples on the watch and sends them when the network returns, without duplicating readings.
• Everything is linked with a one-time code: open RaHel on the watch, type the code in the web dashboard and start seeing your data.

MEASURED AND ESTIMATED, KEPT APART
RaHel does not make data up. What the watch measures is shown as is. What the watch does not measure (heart rate variability, resting heart rate, sleep and stress) is estimated from your heart-rate and step history, and is always labeled "estimated" with its confidence level. Skin temperature is not estimated: it only appears if your watch provides it.

THE WEB DASHBOARD
• See the latest reading and the history of every linked watch.
• Sensor analytics: which fields arrive, with what coverage, which are measured or estimated and which sensors your watch detects, so you can decide which ones to keep.
• Each account only sees the watches it linked itself, and you can unlink a watch at any time.

PRIVACY AND SECURITY
• Data is encrypted in transit (HTTPS).
• Linking codes expire and have an attempt limit.
• No ads and no selling of data.
• You can ask for your data to be deleted at any time: [support email].

IMPORTANT
RaHel is not a medical device and does not diagnose or treat any condition. The information it shows is indicative and does not replace the assessment of a health professional. If you have symptoms or an emergency, contact a professional or your local emergency services.

REQUIREMENTS
• A watch running Wear OS 3 or later (Android 11 or newer).
• To see data in the dashboard: an account at https://rahel.hermesbackend.xyz and an internet connection on the watch.
• Available sensors depend on your watch model.
```

### Release notes (≤ 500) · 1.0.0

```
First release of RaHel.
• Heart rate and step measurement from the watch.
• On-screen wellbeing assessment.
• Secure upload to the web dashboard with code-based linking.
• Works offline and resends when the network returns.
```

---

## Material gráfico

| Recurso | Requisito de Play | Estado |
|---|---|---|
| Ícono | PNG 512×512, ≤ 1 MB | Listo: [icon-512.png](icon-512.png) |
| Gráfico de funciones | 1024×500, PNG/JPEG | Pendiente (ver abajo) |
| Capturas de reloj | 1 a 8, formato 1:1, de 384×384 a 3840×3840 px, sin marco de dispositivo | Pendientes |

**Gráfico de funciones (1024×500):** fondo verde `#007A39`, el logo a la izquierda y a la derecha el texto «El pulso de cada persona, del reloj al panel.» en blanco rosado `#FFE5E7`, tipografía Outfit ExtraBold. Se puede generar con la misma plantilla HTML de la imagen para redes (`frontend/public/og-image.png`) cambiando el tamaño.

**Capturas (emulador Wear OS Large Round, Android Studio > Device Manager):**

| # | Pantalla | Texto de apoyo sugerido |
|---|---|---|
| 1 | Monitor de signos vitales con el pulso en vivo | Tu pulso, en tu muñeca |
| 2 | Evaluación de bienestar | Una lectura clara de cómo estás |
| 3 | Pantalla de vinculación con el código | Vincula tu reloj con un código |
| 4 | Permisos de sensores en el onboarding | Tú decides qué sensores usar |
| 5 | Tile o complicación, si está disponible | Tu dato a un vistazo |

Para mostrar el panel web, súbelo como imagen aparte en la ficha (las capturas de Wear OS deben ser del reloj; el panel solo sirve como apoyo en el gráfico de funciones).

---

## Información para la revisión de Play

**Acceso a la app (Contenido de la app > Acceso a la app):** la sincronización requiere una cuenta y vincular el reloj. Indicar:

```
La app funciona en el reloj sin cuenta para ver la lectura en pantalla.
Para probar la sincronización:
1. Crear una cuenta en https://rahel.hermesbackend.xyz/app
2. Abrir RaHel en el reloj: aparece un código de vinculación.
3. En el panel, escribirlo en "Vincular reloj" antes de que caduque (10 minutos).
Cuenta de prueba: [correo] / [contraseña]
```

**Declaración del servicio en primer plano (tipo Salud):**

```
RaHel runs a foreground service of type "health" (HealthForegroundService) that the user starts and stops with the "Start monitoring" / "Stop monitoring" button on the main screen. While it runs it keeps reading heart rate and steps with the screen off and syncs the readings to the user's linked account; a persistent notification ("Monitoring vital signs") is shown the whole time. When the user taps "Stop monitoring" the service stops and the notification disappears.
If the system deferred this task, the user would lose heart-rate and step readings and their history would have gaps.
```

**Vídeo (Google pide mostrar al usuario iniciando la función):** abrir la app, conceder los permisos de sensores y actividad, pulsar **«Start monitoring»**, mostrar la notificación permanente y el pulso en vivo, apagar y encender la pantalla, y pulsar **«Stop monitoring»** para ver que la notificación desaparece. Ver [la guía de grabación](../play-store.md#5-permisos-y-declaraciones-sensibles).

**Declaración de apps de salud:** seguimiento de actividad y signos vitales / bienestar. Marcar que **no** es un dispositivo médico.

**Clasificación y público:** sin violencia ni contenido sensible; público objetivo 18+; no dirigida a niños; sin anuncios.

---

## Antes de pulsar «Publicar»

- [ ] Correo de soporte y URL de la política de privacidad publicadas (reemplazar los `[corchetes]`).
- [ ] Gráfico de funciones y al menos 1 captura de reloj.
- [ ] AAB **firmado** (el actual está sin firmar) y subido a Pruebas internas.
- [ ] Formulario de seguridad de los datos completado con [la tabla de la checklist](../play-store.md#4-formulario-de-seguridad-de-los-datos-data-safety).
- [ ] Vídeo del servicio en primer plano.
- [ ] Si la cuenta es personal y nueva: prueba cerrada con ≥ 12 testers durante 14 días.
