# Checklist de publicación en Google Play (RaHel, Wear OS)

Datos de la app: paquete `xyz.targapps.rahel`, versionCode 17 / versionName 1.0.16, minSdk 30 (Wear OS 3+), targetSdk 36, app independiente (standalone), formato AAB.

## 0. Construir y firmar
1. Crear `app/keystore.properties` (ver `app/keystore.properties.example`; está en .gitignore) o exportar `RAHEL_KEYSTORE_FILE`, `RAHEL_KEYSTORE_PASSWORD`, `RAHEL_KEY_ALIAS`, `RAHEL_KEY_PASSWORD`.
2. `./gradlew :app:bundleRelease` -> `app/app/build/outputs/bundle/release/app-release.aab` (si no hay configuración de firma se genera SIN firmar y Play Console lo rechazará).
3. Verificar: `jarsigner -verify -verbose -certs app-release.aab`.
4. Recomendado: inscribirse en **Play App Signing**; la clave local sería la clave de subida (upload key). Si no se puede abrir la keystore existente, se puede crear una nueva: `keytool -genkeypair -v -keystore upload-keystore.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`. Guardar copia de seguridad fuera del repo.
5. Subir `app/app/build/outputs/mapping/release/mapping.txt` (R8 está activo) para desofuscar crashes; el AAB ya lo incluye en BUNDLE-METADATA.

## 1. Cuenta y app
- Cuenta de desarrollador (si es personal creada después de nov-2023: **prueba cerrada con >= 12 testers durante 14 días** antes de producción).
- Crear app: nombre "RaHel", idioma por defecto es-419 (o es-ES), tipo App, gratuita.
- En Formulario de dispositivos: marcar **Wear OS**. La app declara `android.hardware.type.watch`, así que solo se sirve a relojes.

## 2. Ficha de Play Store
- Título (<= 30): `RaHel`
- Descripción breve (<= 80): "Monitoreo de bienestar y salud desde tu reloj Wear OS."
- Descripción completa: qué mide (frecuencia cardíaca y pasos; el servidor estima pulso en reposo, HRV, sueño y estrés a partir del historial), evaluaciones de bienestar, sincronización opcional con panel web; incluir el aviso "No es un dispositivo médico ni sustituye consejo profesional".
- Icono 512x512: `docs/play-store/icon-512.png` (listo).
- Gráfico de funciones 1024x500: pendiente (fondo #007A39, wordmark #FFE5E7).
- **Capturas de reloj**: mínimo 1 y hasta 8, PNG/JPEG cuadradas 1:1 (p. ej. 384x384 a 3840x3840), sin marcos de dispositivo. Generar con emulador Wear OS redondo (Android Studio > Device Manager > Wear OS Large Round): pantalla de inicio/permisos, monitor de signos vitales, evaluación, vinculación, tile.
- Categoría: Salud y bienestar (o Salud y estado físico). Datos de contacto: email, web.
- **URL de política de privacidad (OBLIGATORIA por datos de salud)**: publicar `docs/privacy-policy.md` (completada) en una URL HTTPS pública y pegarla en Contenido de la app > Política de privacidad. También debe ser accesible dentro de la app o desde la ficha.

## 3. Contenido de la app
- **Declaración de apps de salud** (Contenido de la app > Apps de salud): marcar funciones usadas: seguimiento de actividad/signos vitales/bienestar. Declarar que NO es un dispositivo médico y que no hay diagnóstico; incluir el disclaimer (la app ya muestra uno en cada evaluación).
- **Clasificación de contenido** (IARC): cuestionario sin violencia ni contenido sensible; se espera "Para todos".
- **Público objetivo**: 18+ (o 16+); no dirigida a niños.
- **Anuncios**: No contiene anuncios.
- **Acceso a la app**: si la sincronización exige vinculación de cuenta/código, proporcionar instrucciones o credenciales de prueba para el revisor (código de emparejamiento / cuenta demo).
- **Apps de gobierno / finanzas / noticias**: No.

## 4. Formulario de seguridad de los datos (Data safety)
Recopilación: **Sí**. Compartición con terceros: **No** (el alojamiento propio no cuenta como compartir). Cifrado en tránsito: **Sí (HTTPS)**. Solicitud de eliminación de datos: **Sí** (por email / panel); indicar URL o email.

| Categoría | Tipo | Recopilado | Obligatorio | Finalidad |
|---|---|---|---|---|
| Salud y forma física | Información de salud (FC medida; pulso en reposo, HRV, sueño y estrés estimados en el servidor) | Sí | No (la sincronización es opcional) | Funcionalidad de la app |
| Salud y forma física | Información sobre forma física (pasos, actividad) | Sí | No | Funcionalidad de la app |
| Información personal | Otra info (sexo biológico, peso, altura, IMC) | Sí | No | Funcionalidad de la app |
| Identificadores de app/dispositivo | ID de dispositivo/otros (crewMemberId, token de dispositivo) | Sí | Sí para sincronizar | Funcionalidad, seguridad |
| Info de la app y rendimiento | (no se recopilan crashes de terceros; los de Play Console son de Google) | No | - | - |

Sin datos de ubicación, contactos, fotos, audio, ni publicidad. Los datos no se venden.

## 5. Permisos y declaraciones sensibles
| Permiso | Justificación para el revisor |
|---|---|
| `BODY_SENSORS` (solo hasta Android 15) | Lectura de la frecuencia cardíaca en relojes con Wear OS 5.1 o anterior. |
| `health.READ_HEART_RATE` | Wear OS 6 / Android 16: sustituye a `BODY_SENSORS` para leer el pulso, función central de la app. |
| `health.READ_HEALTH_DATA_IN_BACKGROUND` | Wear OS 6: seguir leyendo el pulso con la pantalla apagada (servicio en primer plano de salud). |
| `ACTIVITY_RECOGNITION` | Pasos diarios y actividad para el cálculo de bienestar. |
| `HIGH_SAMPLING_RATE_SENSORS` | Muestreo de HRV con precisión suficiente. |
| `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_HEALTH` | Monitorización continua de signos vitales con la pantalla apagada. |
| `POST_NOTIFICATIONS` | Notificación del servicio en primer plano y alertas de bienestar. |
| `INTERNET`, `ACCESS_NETWORK_STATE` | Sincronización con el backend (HTTPS). |
| `WAKE_LOCK` | Mantener lectura/sincronización durante el servicio. |

- **Declaración de servicio en primer plano** (Contenido de la app > Permisos de servicio en primer plano): tipo **Salud (health)** para `.service.HealthForegroundService`. Describir el caso de uso: "monitorización continua de frecuencia cardíaca y actividad iniciada por el usuario"; adjuntar vídeo corto (<= 1 min, YouTube no listado) mostrando: usuario concede permisos, inicia monitorización, aparece la notificación persistente, los datos en pantalla.
- Permisos de salud en Android 14+: `FOREGROUND_SERVICE_HEALTH` exige tener al menos `BODY_SENSORS`/`ACTIVITY_RECOGNITION` concedido en tiempo de ejecución antes de iniciar el servicio (la app lo solicita en el onboarding).
- Health Services (Wear): no requiere formulario especial de Health Connect; si en el futuro se integra Health Connect, habrá que completar su declaración propia.

## 6. Seguridad y política
- Cleartext deshabilitado en release (`usesCleartextTraffic=false`); solo se usa `https://rahel.hermesbackend.xyz/api/`.
- `allowBackup=false`. Minificación R8 + reducción de recursos activas.
- targetSdk 36 (Android 16) cumple el requisito vigente de Play (>= 35 para nuevas apps y actualizaciones desde ago-2025; el requisito sube cada año en agosto).
- APKs de 64 bits: la app no incluye código nativo propio (solo Kotlin/Java), por lo que es compatible con 64-bit.
- Wear OS: la app es standalone (`com.google.android.wearable.standalone=true`), no requiere app de teléfono.

## 7. Pruebas y lanzamiento
1. Probar el AAB firmado en un reloj real y en el emulador (flujo de permisos, vinculación, servicio en primer plano, tile, complicación).
2. Pista **Pruebas internas**: subir AAB, añadir testers, verificar la instalación desde Play.
3. Pista **Pruebas cerradas**: >= 12 testers opt-in durante 14 días continuos (cuentas personales nuevas); recoger feedback y corregir.
4. Revisar "Pre-launch report" y Android vitals.
5. Solicitar acceso a producción, completar notas de la versión (es / en), lanzamiento escalonado (p. ej. 20 %).
6. Mantener `versionCode` creciente en cada subida (1 -> 2 -> ...).


## Nota: permisos de salud nuevos (Wear OS 6)
A partir de la versión 9 (sin SpO2: la app no lo lee) la app declara `android.permission.health.READ_HEART_RATE` y `READ_HEALTH_DATA_IN_BACKGROUND`. En *Contenido de la app > Apps de salud* Play puede pedir justificar también estos permisos; usa el mismo texto de `BODY_SENSORS` (lectura de pulso y SpO2 para el seguimiento de bienestar del propio usuario).
