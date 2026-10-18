# Política de privacidad de RaHel (borrador)

> BORRADOR: completar los campos entre [corchetes], revisar con asesoría legal y publicar en una URL pública (HTTPS) antes de enviar la app a Play Store.

Última actualización: [FECHA]
Responsable del tratamiento: [NOMBRE / RAZÓN SOCIAL], contacto: [EMAIL DE PRIVACIDAD], dirección: [DIRECCIÓN]

## 1. Qué es RaHel
RaHel es una aplicación para relojes Wear OS (paquete `xyz.targapps.rahel`) que monitorea indicadores de bienestar y salud del usuario, aplica reglas de evaluación y, si el usuario vincula su reloj con una cuenta, sincroniza esos datos con un panel web. RaHel no es un dispositivo médico, no diagnostica ni trata enfermedades y no sustituye el consejo de un profesional de la salud.

## 2. Datos que recogemos
**Datos de salud y actividad (sensores del reloj, con tu permiso):**
- Frecuencia cardíaca y frecuencia cardíaca en reposo.
- Estimaciones que calcula el servidor a partir de tu historial de pulso y pasos (pulso en reposo, variabilidad, sueño y estrés). Se marcan como estimadas y no son mediciones.
- Pasos diarios y reconocimiento de actividad.
- Horas de sueño de la última noche.
- Puntuación de estrés estimada y síntomas autorreportados dentro de la app.
- Evaluaciones generadas por las reglas de la app (nivel, resumen, condiciones posibles y acciones recomendadas).

**Datos de perfil que tú indicas:** sexo biológico, peso, altura e índice de masa corporal (IMC) calculado.

**Datos de vinculación y técnicos:** identificador del miembro/perfil (crewMemberId), token de dispositivo emitido al vincular el reloj (se guarda cifrado en el dispositivo), identificador de lote de sincronización, marcas de tiempo, e inventario técnico de sensores disponibles del reloj. No recogemos ubicación, contactos, fotos, micrófono ni identificadores publicitarios.

## 3. Para qué usamos los datos
- Calcular en el reloj evaluaciones de bienestar y alertas.
- Mostrar tu historial y tendencias en el panel web cuando vinculas el reloj.
- Operar, mantener y mejorar la seguridad y estabilidad del servicio.
No vendemos tus datos, no los usamos para publicidad y no los compartimos con terceros con fines comerciales.

## 4. Dónde se guardan
- **En el reloj:** perfil, preferencias y una cola local (base de datos Room) de lecturas pendientes de envío. El token de dispositivo se almacena cifrado.
- **En nuestro servidor** (`rahel.hermesbackend.xyz`, API sobre HTTPS), alojado en [PROVEEDOR / PAÍS], solo si vinculas el reloj con una cuenta. Los datos viajan cifrados en tránsito (TLS).
- La app no usa copias de seguridad en la nube de Android (`allowBackup=false`).

## 5. Con quién los compartimos
Solo con proveedores de infraestructura que actúan como encargados del tratamiento (alojamiento del servidor: [PROVEEDOR]) y cuando lo exija la ley. No hay SDK de publicidad ni de analítica de terceros en la app.

## 6. Conservación
- Datos en el reloj: hasta que desinstales la app o borres sus datos; las lecturas en cola se eliminan tras sincronizarse.
- Datos en el servidor: [PLAZO, p. ej. 12 meses desde la lectura] o hasta que solicites su eliminación o elimines tu cuenta; después se borran o anonimizan.

## 7. Tus derechos y control
Puedes: retirar en cualquier momento los permisos de sensores desde Ajustes del reloj; desvincular el reloj; acceder, rectificar, exportar y solicitar la eliminación de tus datos (y de tu cuenta) escribiendo a [EMAIL DE PRIVACIDAD]; responderemos en un máximo de [30] días. Según tu jurisdicción (GDPR, LGPD, CCPA, etc.) puedes tener derechos adicionales y a reclamar ante la autoridad de protección de datos competente.

## 8. Permisos que solicita la app y por qué
| Permiso | Motivo |
|---|---|
| Sensores corporales (BODY_SENSORS / READ_HEART_RATE) | Leer la frecuencia cardíaca. |
| Datos de salud en segundo plano (READ_HEALTH_DATA_IN_BACKGROUND) | Seguir leyendo el pulso con la pantalla apagada. |
| Reconocimiento de actividad (ACTIVITY_RECOGNITION) | Contar pasos y detectar actividad. |
| Servicio en primer plano de salud (FOREGROUND_SERVICE_HEALTH) | Mantener la monitorización continua con el reloj en reposo. |
| Notificaciones (POST_NOTIFICATIONS) | Avisar de alertas de bienestar y de la monitorización activa. |
| Internet / estado de red | Sincronizar con el panel web cuando el reloj está vinculado. |
| Alta frecuencia de muestreo, WAKE_LOCK | Lecturas precisas y sincronización fiable. |

## 9. Menores
RaHel no está dirigida a menores de [16/13] años y no recopilamos conscientemente sus datos.

## 10. Seguridad
Cifrado en tránsito (HTTPS), token de dispositivo cifrado en el reloj, autenticación por token en la API y minimización de datos. Ningún sistema es 100 % seguro; notificaremos las brechas según la ley aplicable.

## 11. Cambios
Publicaremos aquí cualquier cambio y actualizaremos la fecha. Para cambios sustanciales te avisaremos en la app o por correo.

## 12. Contacto
[NOMBRE] · [EMAIL DE PRIVACIDAD] · [DIRECCIÓN]
