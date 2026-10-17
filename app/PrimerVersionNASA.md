# Especificación Técnica Integrada: Monitoreo de Salud del Astronauta

<!-- Este archivo reúne dos especificaciones independientes del sistema de monitoreo del reloj inteligente. Cada una conserva su propio vector de características, sus variables dinámicas y su numeración de eventos.

## Índice

| Parte | Módulo | Variables de línea de base | Eventos |
| :--- | :--- | :--- | :--- |
| **I** | Monitoreo Cardiovascular Espacial | 11 ($\mathbf{x} \in \mathbb{R}^{11}$) | 5 |
| **II** | Salud Conductual y Aislamiento (versión depurada) | 5 ($\mathbf{x} \in \mathbb{R}^{5}$) | 3 | -->

> **Nota:** la numeración de eventos y de variables ($x_1, x_2, \dots$) se reinicia en cada parte. Al citar un evento, indica siempre la parte (por ejemplo, *Parte I, Evento 2*).

<br>

---



---

# ═══════════════ PARTE I ═══════════════
# MÓDULO CARDIOVASCULAR ESPACIAL

---
---

# Especificación Técnica: Módulo de Monitoreo Cardiovascular Espacial

Este documento detalla la especificación completa para el módulo de ingesta y detección cardiovascular en entornos de microgravedad. Incluye la definición de variables de línea de base, variables dinámicas en tiempo real, reglas de decisión mediante Z-score y sugerencias operativas de acción.

---

## 1. Las 11 Variables de Línea de Base ($x_1$ a $x_{11}$)

Estas variables biométricas se recopilan una sola vez durante el cuestionario de incorporación para establecer el perfil fisiológico de referencia ($\mu_{\text{base}}$, $\sigma_{\text{base}}$) de cada astronauta en la Tierra.

| Componente | Variable | Pregunta Origen | Tipo de Dato | Descripción y Método de Obtención |
| :--- | :--- | :--- | :--- | :--- |
| **$x_1$** | `edad` | Pregunta 1 | Continuo ($\mathbb{R}^+$) | **Edad en años.** Ingresada por el usuario. Modula el coeficiente de elasticidad arterial. |
| **$x_2$** | `sexo_biologico` | Pregunta 2 | Binario ($0$ / $1$) | **Sexo al nacer** ($0 = \text{Femenino}, 1 = \text{Masculino}$). Define coeficientes metabólicos $K_{\text{sex}}$. |
| **$x_3$** | `imc` | Pregunta 3 | Continuo ($\mathbb{R}^+$) | **Índice de Masa Corporal.** Calculado automáticamente: $\text{IMC} = \frac{\text{peso (kg)}}{(\text{altura (m)})^2}$. |
| **$x_4$** | `riesgo_genetico` | Pregunta 4 | Binario ($0$ / $1$) | **Antecedentes cardíacos directos** ($1 = \text{Sí}, 0 = \text{No/Desc}$). Asigna el peso genético $w_{\text{gen}}$. |
| **$x_5$** | `antecedentes_medicos` | Pregunta 5 | Multihot / Categórico | **Afecciones diagnosticadas** (Hipertensión, Arritmia, Colesterol). Codificado en mapa de bits. |
| **$x_6$** | `historial_sincope` | Pregunta 6 | Binario ($0$ / $1$) | **Episodios previos de desmayo/mareos** ($1 = \text{Sí}, 0 = \text{No}$). Sensibiliza alertas de intolerancia ortostática. |
| **$x_7$** | `uso_medicacion` | Pregunta 7 | Binario ($0$ / $1$) | **Tratamiento farmacológico activo** ($1 = \text{Sí}, 0 = \text{No}$). Contextualiza respuestas de frecuencia cardíaca. |
| **$x_8$** | `fc_reposo_base` ($\mu_{\text{HR}}$) | Pregunta 8 | Continuo ($\text{BPM}$) | **Frecuencia cardíaca media en reposo en la Tierra.** Ingreso manual o historial del reloj inteligente. |
| **$x_9$** | `pa_reposo_base` ($\mu_{\text{BP}}$) | Pregunta 9 | Par continuo ($\text{mmHg}$) | **Presión arterial habitual en la Tierra.** Par (Sistólica / Diastólica). |
| **$x_{10}$** | `hrv_base` ($\mu_{\text{HRV}}$) | Pregunta 10 | Continuo ($\text{ms}$) | **Variabilidad de la frecuencia cardíaca de referencia.** Registrada en reposo o calibrada en 72h. |
| **$x_{11}$** | `nivel_actividad` | Pregunta 11 | Ordinal ($1, 2, 3$) | **Ejercicio semanal** ($1 = <3\text{h}, 2 = 3\text{--}6\text{h}, 3 = >6\text{h}$). Calibra la tasa esperada de recuperación. |

---

## 2. Variables Dinámicas en Tiempo Real (Sensores)

Estas variables son leídas e ingestadas continuamente por los sensores del reloj inteligente durante la misión:

- **`ecg_flag`**: Booleano generado por el sensor ECG ($0 = \text{Ritmo normal}, 1 = \text{Anomalía detectada}$).
- **`hr_resting`**: Frecuencia cardíaca en reposo instantánea ($\text{BPM}$), obtenida vía PPG/óptico.
- **`motion`**: Nivel de actividad física obtenido del acelerómetro ($0 = \text{Estacionario}, 1 = \text{En movimiento}$).
- **`hrv_ms`**: Variabilidad de la frecuencia cardíaca actual ($\text{ms}$), agrupada en ventana móvil de 7 días ($\overline{\text{HRV}}_{7d}$).
- **`spo2_pct`**: Saturación periférica de oxígeno en sangre ($\%$).
- **`delta_az`**: Variación repentina de la aceleración en el eje vertical $Z$ ($\text{m/s}^2$).
- **`api_rad_flux`**: Flujo de protones solares ($\text{pfu}$) consumido en tiempo real desde la API de clima espacial (ej. NASA DONKI).

---

## 3. Vectorización y Análisis de Anomalías por Z-Score

### Representación del Vector de Características

Las 11 variables estáticas recopiladas en el registro inicial se estructuran en un vector columna normalizado $\mathbf{x}$:

$$\mathbf{x} = \begin{bmatrix} x_1 & x_2 & x_3 & x_4 & x_5 & x_6 & x_7 & x_8 & x_9 & x_{10} & x_{11} \end{bmatrix}^T \in \mathbb{R}^{11}$$

### Regla de Evaluación Estadística (Z-Score)

Para evitar el uso de umbrales globales fijos, cada parámetro fisiológico medido en tiempo real ($x_{\text{medido}}$) se compara dinámicamente con la línea de base individual del astronauta:

$$Z = \frac{x_{\text{medido}} - \mu_{\text{base}}}{\sigma_{\text{base}}}$$

- **Rango Normal:** $\vert{}Z\vert{} \le 1.5$ (Variación fisiológica esperada)
- **Anomalía Moderada (Alerta Amarilla):** $1.5 < \vert{}Z\vert{} \le 2.5$
- **Anomalía Crítica (Alerta Roja):** $\vert{}Z\vert{} > 2.5$

---

## 4. Reglas de Detección en Tiempo Real y Sugerencias Operativas

### Evento 1: Posible Fibrilación Auricular (Alteración Eléctrica)

Lógica en C:

```c
if (ecg_flag == true && hr_resting > 120 && motion == 0) {
    activar_alerta(ALERTA_AMARILLA, "Posible Fibrilación Auricular detectada en reposo.");
}
```

> **Sugerencia de acción:** Adoptar inmediatamente una posición de reposo reclinada (30° a 45°), evitar esfuerzos o maniobras de Valsalva no supervisadas y activar una lectura manual de ECG de 60 segundos para transmitir la tira de ritmo al equipo médico en Tierra.

---

### Evento 2: Respuesta Vascular Asociada a Radiación Solar/Cósmica

Evaluación previa de Z-score para la HRV:

$$Z_{\text{HRV}} = \frac{\overline{\text{HRV}}_{7d} - x_{10}}{\sigma_{\text{HRV}}}$$

Lógica en C:

```c
if (Z_HRV < -2.0 && api_rad_flux > 10.0) {
    activar_alerta(ALERTA_ALTA, "Caída de HRV consistente con evento de radiación solar.");
}
```

> **Sugerencia de acción:** Verificar la cobertura y blindaje en el módulo habitacional actual, suspender temporalmente actividades extravehiculares (EVA) no esenciales y registrar los datos de hidratación y marcadores de tensión oxidativa con el oficial médico.

---

### Evento 3: Síncope Espacial e Intolerancia Ortostática

Lógica en C (sensibilizada si $x_6 = 1$):

```c
if (delta_az > 2.5 && delta_HR_5s < 5 && delta_SpO2 < -2.0) {
    emitir_vibracion_haptica();
    mostrar_mensaje_pantalla("Riesgo de desmayo ortostático. Afiérrese a los pasamanos.");
}
```

> **Sugerencia de acción:** Agarrarse de inmediato a las fijaciones físicas más cercanas, realizar contracciones musculares isométricas intermitentes en miembros inferiores (gemelos y cuadríceps) para promover el retorno venoso y ajustar la presión de las prendas compresivas abdominales/pélvicas.

---

### Evento 4: Desincronización Circadiana y Estrés por Aislamiento

* **Peligro Espacial:** Aislamiento y Confinamiento (*Isolation & Confinement*).
* **Problema en la Consigna:** Salud Conductual (*Behavioral Health Problems*).
* **Explicación Simple:** La falta de ciclo luz/oscuridad natural y el espacio reducido elevan los niveles sostenidos de cortisol, alterando la temperatura corporal y la arquitectura del sueño.
* **Datos Utilizados:** `temp_skin` (Sensor de Temperatura de la piel), `hr_resting` (Frecuencia cardíaca nocturna) y `motion` (Giroscopio/Acelerómetro nocturno).
* **Fórmula de Evaluación:**
  $$\text{SI } (\text{temp\_skin} > 37.0^\circ\text{C}) \land (\text{motion\_nocturno} > \text{umbral}) \land (Z_{\text{HRV}} < -1.5)$$
* **Sugerencia de Acción:** *"Patrón de sueño fragmentado y estrés térmico. Inicie sesión de relajación/respiración guiada de 10 minutos y ajuste la luz de cabina a espectro rojo."*

---

### Evento 5: Estrés Respiratorio por Acumulación de $CO_2$

* **Peligro Espacial:** Entorno Cerrado Hostil (*Hostile Closed Environment*).
* **Problema en la Consigna:** Eventos Cardíacos y Mareos.
* **Explicación Simple:** Sin convección gravitacional, el $CO_2$ exhalado forma bolsas hipercápnicas invisibles. El astronauta inhala aire viciado, reduciendo el oxígeno en sangre ($SpO_2$) e induciendo taquicardia compensatoria.
* **Datos Utilizados:** `spo2_pct` (Sensor óptico infrarrojo), `hr_resting` (Sensor óptico PPG) y `api_co2_ppm` (Sensor de Cabina vía API local).
* **Fórmula de Evaluación:**
  $$\text{SI } (\text{api\_co2\_ppm} > 4000 \text{ ppm}) \land (\text{spo2\_pct} < 94\%) \land (\text{hr\_resting} > x_8 \cdot 1.2)$$
* **Sugerencia de Acción:** *"Acumulación de $CO_2$ en su zona. Cambie de módulo inmediatamente, active la ventilación forzada de cabina y mida su $SpO_2$ en 5 minutos."*

---

## 5. Saber Más: Fundamentos Biomédicos y Fórmulas Utilizadas

Este módulo de detección se sustenta en tres principios centrales de la fisiología espacial y el procesamiento estadístico de señales:

### 1. Normalización por Puntuación Z ($Z$-score Normalization)

$$Z = \frac{x - \mu}{\sigma}$$

En microgravedad, los parámetros cardiovasculares sufren desvíos significativos con respecto a las medias poblacionales terrestres. Calcular la desviación estandarizada contra la media individual ($\mu$) y su variabilidad habitual ($\sigma$) previene falsos positivos al evaluar al usuario contra su propia línea de base.

### 2. Modelo de Riesgo Ponderado Multivariable

Para estimar la susceptibilidad cardiovascular global antes de desencadenar alertas, el sistema calcula un **Índice de Riesgo Base ($R_{\text{base}}$)** combinando el vector de características $\mathbf{x}$ con un vector de pesos $W$:

$$R_{\text{base}} = W^T \mathbf{x} = \sum_{i=1}^{11} w_i \cdot x_i$$

Donde cada $w_i$ penaliza o mitiga el riesgo acumulado (por ejemplo, el peso $w_4$ amplifica el impacto si existe antecedente genético en $x_4$, y $w_6$ incrementa la sensibilidad si había historial de síncope $x_6$).

### 3. Fisiología Cardiovascular en Microgravedad

* **Desplazamiento cefálico de fluidos:** En ausencia de gravedad, entre 1.5 y 2 litros de fluido corporal se desplazan desde las piernas hacia el tórax y la cabeza. Esto aumenta temporalmente la precarga cardíaca, alterando la respuesta de los barorreceptores.
* **Estrés oxidativo y HRV:** La Variabilidad de la Frecuencia Cardíaca (HRV) mide el equilibrio del sistema nervioso autónomo. Una reducción sostenida de la HRV ($\Delta \text{HRV} \downarrow$) acoplada a picos de radiación de alta energía representa un indicador indirecto de disfunción endotelial e inflamación vascular originada por especies reactivas de oxígeno (ROS).

<br>

---
---

# ═══════════════ PARTE II ═══════════════
# MÓDULO DE SALUD CONDUCTUAL Y AISLAMIENTO

---
---

# Especificación Depurada: Módulo de Salud Conductual y Aislamiento

En una selección de astronautas de la NASA/ESA, los antecedentes médicos graves o trastornos de sueño severos quedan descartados en los exámenes clínicos iniciales. Mantener variables en el formulario que no se evalúan explícitamente en el código genera redundancia e infla el vector sin aportar valor práctico.

El formulario se reduce a **5 variables esenciales** ($\mathbf{x} \in \mathbb{R}^5$). Cada una de estas 5 variables se utiliza directamente en las condiciones lógicas y en el cálculo de $Z$-scores de los eventos.

---

## 1. Formulario Reducido: 5 Variables de Línea de Base ($x_1$ a $x_5$)

| Componente | Variable | Tipo de Dato | Uso Directo en el Sistema |
| --- | --- | --- | --- |
| **$x_1$** | `horas_sueno_base` ($\mu_{\text{sueño}}$) | Continuo ($\text{Horas}$) | Referencia para medir pérdida aguda de descanso nocturno. |
| **$x_2$** | `interaccion_base` ($\mu_{\text{pantalla}}$) | Continuo ($\text{Toques/día}$) | Referencia para calcular el $Z$-score de apatía/retraimiento social. |
| **$x_3$** | `hrv_base` ($\mu_{\text{HRV}}$) | Continuo ($\text{ms}$) | Base para calcular el $Z$-score de estrés del sistema nervioso. |
| **$x_4$** | `fc_reposo_base` ($\mu_{\text{HR}}$) | Continuo ($\text{BPM}$) | Base para medir taquicardia o picos de ansiedad en reposo. |
| **$x_5$** | `cronotipo` | Categoría ($1 = \text{Matutino}, 2 = \text{Vespertino}$) | Define si el descanso fuera de horario es esperable o anómalo. |

---

## 2. Variables Dinámicas de los Sensores (5)

* **`despertares_noche`**: Interrupciones del sueño registradas por el acelerómetro y pulso nocturno.
* **`screen_interaction`**: Cantidad de toques diarios en la pantalla del reloj.
* **`eda_microsiemens`**: Conductancia de la piel (sudor galvánico en la correa por estrés).
* **`ambient_light_lux`**: Sensor de luz ambiental en la cabina.
* **`api_crew_schedule`**: Estado de la agenda ($0 = \text{Descanso}, 1 = \text{Trabajo}$).

---

## 3. Vector de Características Reducido

El vector de perfil individual queda definido como:

$$\mathbf{x} = \begin{bmatrix} x_1 & x_2 & x_3 & x_4 & x_5 \end{bmatrix}^T \in \mathbb{R}^5$$

---

## 4. Reglas de Detección en C y Sugerencias Operativas

### Evento 1: Desincronización Circadiana (Insomnio por Luz en Cabina)

Compara el descanso real contra $x_1$ (`horas_sueno_base`) y contempla el $x_5$ (`cronotipo`).

```c
// Si hay despertares frecuentes, luz alta fuera de horario y no es su ventana habitual de descanso
if (despertares_noche > 3 && ambient_light_lux > 200 && api_crew_schedule == 0) {
    activar_alerta(ALERTA_AMARILLA, "Luz ambiental interrumpiendo el ciclo de sueño.");
}
```

> **Sugerencia de acción:** Reducir la intensidad de la iluminación en el módulo habitacional, colocar el antifaz de descanso e iniciar la guía de respiración de 5 minutos en el reloj.

---

### Evento 2: Apatía Espacial y Retraimiento Social

Compara la interacción del día contra $x_2$ (`interaccion_base`) y la HRV contra $x_3$ (`hrv_base`).

$$Z_{\text{pantalla}} = \frac{\text{screen\_interaction} - x_2}{\sigma_{\text{pantalla}}}, \quad Z_{\text{HRV}} = \frac{\text{hrv\_actual} - x_3}{\sigma_{\text{HRV}}}$$

```c
// Caída severa en el uso del dispositivo combinada con alteración de la HRV
if (Z_pantalla < -2.0 && Z_HRV < -1.5) {
    activar_alerta(ALERTA_ALTA, "Indicadores de retraimiento y apatía por aislamiento.");
}
```

> **Sugerencia de acción:** Realizar una pausa activa recreativa, coordinar una sesión de comunicación con el equipo en Tierra o reunirse con la tripulación en el módulo común.

---

### Evento 3: Pico de Estrés Agudo en Reposo

Evalúa la sudoración galvánica combinada con desvíos respecto a $x_3$ (`hrv_base`) y $x_4$ (`fc_reposo_base`).

$$Z_{\text{FC}} = \frac{\text{fc\_actual} - x_4}{\sigma_{\text{FC}}}$$

```c
// Elevación de sudoración galvánica y FC en reposo durante horario de trabajo
if (eda_microsiemens > 5.0 && Z_FC > 2.0 && api_crew_schedule == 1) {
    emitir_vibracion_haptica();
    mostrar_mensaje_pantalla("Pico de estrés agudo detectado.");
}
```

> **Sugerencia de acción:** Pausar la tarea en ejecución si las condiciones de seguridad lo permiten, beber agua y realizar el protocolo de respiración guiada en caja (4-4-4-4) durante 2 minutos.

---

## 5. Fundamento de Simplificación

Al eliminar variables redundantes (antecedentes clínicos o medicación que filtrarían en las pruebas terrestres), el sistema pasa a calcular desviaciones exclusivas sobre **métricas del comportamiento diario y valores de referencia en reposo**.

La evaluación estadística $Z$-score se aplica directamente sobre los valores leídos en tiempo real respecto a sus medias personales ($\mu_{\text{sueño}}, \mu_{\text{pantalla}}, \mu_{\text{HRV}}, \mu_{\text{HR}}$), garantizando que el reloj reaccione solo cuando el astronauta cambia radicalmente su propio patrón habitual en la nave.














# ═══════════════ PARTE III ═══════════════
**═══════════════ MÓDULO BONE LOSS ═══════════════**

# MÓDULO DE PREVENCIÓN DE PÉRDIDA ÓSEA Y CÁLCULOS RENALES

---

# Especificación del Módulo Bone Loss

Durante una misión espacial, la microgravedad favorece la pérdida de masa ósea. Este proceso puede aumentar la liberación de calcio de los huesos y contribuir al riesgo de formación de cálculos renales.

El módulo implementa dos funciones preventivas mediante el reloj inteligente:

- **Evento 1:** Recordatorio de hidratación.
- **Evento 2:** Recordatorio de ingesta de calcio.

Ambos eventos utilizan variables sencillas, obtenidas del registro del astronauta y del sistema de planificación de la misión.

---

## 1. Variables de Línea de Base

| Variable | Tipo de Dato | Dónde está alojada / Cómo se obtiene |
| --- | --- | --- |
| `dias_en_mision` | Entero (días) | Se obtiene del sistema de la nave mediante la fecha actual y la fecha de despegue. |
| `objetivo_agua_ml` | Entero (ml/día) | Cantidad diaria de agua establecida por el equipo médico de la misión. |
| `objetivo_calcio_mg` | Entero (mg/día) | Objetivo diario de calcio establecido por el equipo médico de la misión. |

---

## 2. Variables Dinámicas del Sistema

| Variable | Tipo de Dato | Dónde está alojada / Cómo se obtiene |
| --- | --- | --- |
| `agua_consumida_ml` | Entero (ml) | Se obtiene del registro de ingesta de agua realizado por el astronauta en el reloj. |
| `calcio_consumido_mg` | Entero (mg) | Se obtiene del registro de alimentos y suplementos de calcio declarados por el astronauta. |
| `horas_desde_ultima_ingesta_agua` | Entero (horas) | Se calcula a partir de la hora de la última ingesta registrada. |
| `horas_desde_ultima_ingesta_calcio` | Entero (horas) | Se calcula a partir de la hora de la última ingesta de calcio registrada. |
| `api_crew_schedule` | Booleano (0 o 1) | Se obtiene de la agenda de la misión: \(0 = \text{descanso}\), \(1 = \text{trabajo}\). |
| `recordatorio_agua_emitido` | Booleano (0 o 1) | Variable interna que evita repetir el mismo recordatorio inne

3. Eventos de Prevención en C

Evento 1: Recordatorio de Hidratación

Objetivo: recordar al astronauta que registre su ingesta de agua cuando haya pasado un intervalo establecido sin una ingesta registrada.

Variables utilizadas:

horas_desde_ultima_ingesta_agua

api_crew_schedule

recordatorio_agua_emitido

Regla de detección:

// Recordatorio de hidratación durante el horario de trabajo
if (horas_desde_ultima_ingesta_agua >= 2 &&
    api_crew_schedule == 1 &&
    recordatorio_agua_emitido == 0) {

    mostrar_mensaje_pantalla(
        "Recordatorio: registra tu ingesta de agua."
    );

    emitir_vibracion_haptica();

    recordatorio_agua_emitido = 1;
}

Restablecimiento del recordatorio:

// Se ejecuta cuando el astronauta registra una nueva ingesta
if (nueva_ingesta_agua == 1) {

    actualizar_agua_consumida();

    recordatorio_agua_emitido = 0;
}

Sugerencia de acción: beber agua de acuerdo con el plan de hidratación de la misión y registrar la cantidad consumida.

Evento 2: Recordatorio de Ingesta de Calcio

Objetivo: recordar al astronauta que revise su ingesta de calcio cuando el registro diario indique que todavía no alcanzó el objetivo establecido.

Variables utilizadas:

calcio_consumido_mg

objetivo_calcio_mg

horas_desde_ultima_ingesta_calcio

api_crew_schedule

recordatorio_calcio_emitido

Regla de detección:

// Recordatorio de calcio durante el horario de trabajo
if (calcio_consumido_mg < objetivo_calcio_mg &&
    horas_desde_ultima_ingesta_calcio >= 4 &&
    api_crew_schedule == 1 &&
    recordatorio_calcio_emitido == 0) {

    mostrar_mensaje_pantalla(
        "Recordatorio: revisa tu ingesta de calcio."
    );

    emitir_vibracion_haptica();

    recordatorio_calcio_emitido = 1;
}

Restablecimiento del recordatorio:

// Se ejecuta cuando se registra una nueva ingesta de calcio
if (nueva_ingesta_calcio == 1) {

    actualizar_calcio_consumido();

    recordatorio_calcio_emitido = 0;
}

Sugerencia de acción: revisar el registro nutricional y consumir alimentos ricos en calcio según el plan nutricional de la misión. Los suplementos solo deben utilizarse según la indicación del equipo médico.

4. Resumen de Funcionamiento

Evento

Condición principal

Acción

Hidratación

Pasaron 2 horas o más desde la última ingesta registrada.

Emitir recordatorio para registrar y revisar la ingesta de agua.

Calcio

La ingesta diaria registrada es inferior al objetivo y pasaron 4 horas o más desde la última ingesta.

Emitir recordatorio para revisar la ingesta de calcio.

5. Fundamento de Simplificación

El módulo utiliza variables de registro y reglas condicionales simples, sin depender de sensores que no miden directamente la hidratación o la pérdida ósea.

El reloj inteligente funciona como una herramienta de prevención y seguimiento: registra hábitos, recuerda acciones y ayuda al astronauta a cumplir su plan nutricional.

Limitación: estos recordatorios no miden directamente la pérdida de masa ósea ni diagnostican deshidratación o cálculos renales. Los objetivos de agua y calcio deben ser definidos por el equipo médico de la misión y adaptados a las necesidades individuales del astronauta.









# ═══════════════ PARTE IV ═══════════════

# MÓDULO DE BEHAVIORAL HEALTH PROBLEMS

---

## 1. Variables Dinámicas de los Sensores

| Variable | Tipo de dato | Fuente |
| --- | --- | --- |
| `minutos_inactividad` | Entero (minutos) | Tiempo acumulado sin movimiento significativo, estimado mediante el acelerómetro. |
| `despertares_noche` | Entero (cantidad) | Eventos de movimiento detectados durante el período de sueño mediante el acelerómetro. |
| `ambient_light_lux` | Real (lux) | Nivel de iluminación medido directamente por el sensor de luz ambiental. |
| `api_crew_schedule` | Entero (0 o 1) | Agenda de la misión: \(0 =\) descanso, \(1 =\) trabajo. |
| `recordatorio_actividad_emitido` | Entero (0 o 1) | Variable interna que evita repetir la alerta de inactividad. |
| `recordatorio_descanso_emitido` | Entero (0 o 1) | Variable interna que evita repetir la alerta de descanso. |

---

## 2. Evento 1: Inactividad Prolongada

**Objetivo:** recordar al astronauta que realice una pausa activa después de un período prolongado sin movimiento.

**Regla de detección:**

```c
if (minutos_inactividad >= 60 &&
    api_crew_schedule == 1 &&
    recordatorio_actividad_emitido == 0) {

    mostrar_mensaje_pantalla(
        "Realiza una pausa activa de 5 minutos."
    );

    emitir_vibracion_haptica();

    recordatorio_actividad_emitido = 1;
}
```

**Restablecimiento:**

```c
if (movimiento_significativo_detectado == 1) {
    minutos_inactividad = 0;
    recordatorio_actividad_emitido = 0;
}
```

**Acción sugerida:** realizar una pausa activa o caminar unos minutos, siempre que las tareas y las condiciones de seguridad lo permitan.

---

## 3. Evento 2: Condiciones Ambientales que Pueden Interrumpir el Sueño

**Objetivo:** advertir sobre condiciones potencialmente desfavorables para el descanso.

**Regla de detección:**

```c
if (despertares_noche >= 3 &&
    ambient_light_lux > 200 &&
    api_crew_schedule == 0 &&
    recordatorio_descanso_emitido == 0) {

    mostrar_mensaje_pantalla(
        "Luz elevada durante el periodo de descanso."
    );

    emitir_vibracion_haptica();

    recordatorio_descanso_emitido = 1;
}
```

**Restablecimiento:**

```c
if (api_crew_schedule == 1) {
    recordatorio_descanso_emitido = 0;
}
```

**Acción sugerida:** reducir la iluminación de la cabina y seguir la rutina de descanso establecida.

---

## 4. Fundamento de Simplificación

El módulo utiliza datos medibles mediante sensores físicos: movimiento e iluminación ambiental.

Las reglas generan recordatorios preventivos, pero no diagnostican depresión, ansiedad ni trastornos del sueño. Los umbrales deben ajustarse y validarse según las condiciones de la misión.







## ═══════════════ PARTE V ═══════════════
# MÓDULO DE TENDENCIA FISIOLÓGICA PERSISTENTE

---
---

# Especificación Técnica: Tendencia Fisiológica Persistente en Entorno Cerrado Hostil

Durante una misión espacial, factores como la microgravedad, la radiación, el aislamiento y las alteraciones del descanso pueden estar relacionados con cambios en el estado fisiológico general, incluido el sistema inmunitario.

El smartwatch **no puede medir directamente la actividad inmunitaria**. Sí registra tres señales de forma directa y fiable durante el sueño: frecuencia cardíaca, HRV y temperatura cutánea. Este módulo las compara con la referencia personal del astronauta y avisa cuando **varias cambian a la vez durante varias noches seguidas**.

> **Objetivo:** detectar cambios persistentes y generar una alerta de seguimiento. **No diagnostica** alteraciones inmunológicas ni de ningún otro tipo.

> **Nota de nombre:** este módulo se llamaba "Monitoreo Indirecto de Cambios Inmunitarios". Se renombra porque el nombre anterior prometía más de lo que el reloj puede medir.

---

## 1. Resumen Rápido

| Elemento | Detalle |
| :--- | :--- |
| **Datos de entrada** | FC nocturna, HRV nocturna y temperatura cutánea nocturna (reloj). Opcional: temperatura de cabina (API local). |
| **Frecuencia de evaluación** | Una vez por noche, al cerrar la ventana de sueño. |
| **Método** | Z-score contra la línea de base personal. |
| **Condición de alerta** | Al menos 2 de 3 señales fuera de su rango, en la dirección esperada, durante 3 noches consecutivas. |
| **Salida** | Mensaje en pantalla + vibración. |

---

## 2. Variables de Línea de Base ($x_1$ a $x_3$)

Se calculan con las **primeras 14 noches válidas** de la misión (o del período de calibración en Tierra, si existe). Para cada señal se guarda la media ($\mu$) y la desviación estándar ($\sigma$).

| Componente | Variable | Tipo de Dato | Descripción | Se guarda |
| :--- | :--- | :--- | :--- | :--- |
| **$x_1$** | `fc_sueno_base` ($\mu_{\text{HR}}$) | Continuo ($\text{BPM}$) | FC media durante el sueño o reposo nocturno (PPG). | $\mu_{\text{HR}}$, $\sigma_{\text{HR}}$ |
| **$x_2$** | `hrv_sueno_base` ($\mu_{\text{HRV}}$) | Continuo ($\text{ms}$) | HRV media durante el sueño, si el reloj la entrega de forma fiable. | $\mu_{\text{HRV}}$, $\sigma_{\text{HRV}}$ |
| **$x_3$** | `temp_skin_base` ($\mu_{\text{Tpiel}}$) | Continuo ($^\circ\text{C}$) | Temperatura cutánea media durante el sueño. | $\mu_{\text{Tpiel}}$, $\sigma_{\text{Tpiel}}$ |

- La línea de base se actualiza **solo** si el diseño contempla una recalibración controlada.
- Si `fc_sueno_base` y `hrv_sueno_base` ya existen en otro módulo (Partes I y II), se **reutilizan** en lugar de duplicarlas.
- Si una noche tiene más de una señal inválida, no entra en el cálculo de la línea de base.

---

## 3. Variables Dinámicas de los Sensores

### 3.1 Datos que entrega el reloj (directos)

| Variable | Tipo de Dato | Fuente | Uso |
| :--- | :--- | :--- | :--- |
| `hr_sleep` | Continuo ($\text{BPM}$) | Sensor óptico PPG | FC media de la noche. |
| `hrv_sleep_ms` | Continuo ($\text{ms}$) | Estimación de HRV del reloj | HRV media de la noche (puede no estar disponible). |
| `temp_skin` | Continuo ($^\circ\text{C}$) | Sensor de temperatura cutánea | Temperatura media de la noche. |
| `sleep_flag` | Booleano ($0$ / $1$) | Detección de sueño del reloj (acelerómetro + PPG) | Define la ventana nocturna a evaluar. |
| `motion` | Booleano ($0$ / $1$) | Acelerómetro | Descarta muestras con movimiento. |

### 3.2 Dato externo opcional (API)

| Variable | Tipo de Dato | Fuente | Uso |
| :--- | :--- | :--- | :--- |
| `api_cabin_temp_c` | Continuo ($^\circ\text{C}$) | Sensor de cabina vía API local | **Solo valida** la lectura de `temp_skin`: si la cabina estuvo fuera del rango de confort, esa señal no se evalúa esa noche. |

> Este módulo **funciona sin API**. Si no hay `api_cabin_temp_c`, la temperatura cutánea se evalúa igual, pero conviene saber que depende del ambiente.

### 3.3 Variables calculadas (no son sensores)

| Variable | Tipo de Dato | Cálculo |
| :--- | :--- | :--- |
| `Z_FC` | Continuo | Desviación de la FC respecto de su referencia. |
| `Z_HRV` | Continuo | Desviación de la HRV respecto de su referencia. |
| `Z_Tpiel` | Continuo | Desviación de la temperatura cutánea respecto de su referencia. |
| `medicion_fc_valida` | Booleano | Ver reglas de validez (sección 5). |
| `medicion_hrv_valida` | Booleano | Ver reglas de validez (sección 5). |
| `medicion_temp_valida` | Booleano | Ver reglas de validez (sección 5). |

### 3.4 Estado interno

| Variable | Tipo de Dato | Función |
| :--- | :--- | :--- |
| `noches_desviadas` | Entero | Noches consecutivas con al menos 2 señales fuera de rango. |
| `alerta_cambios_fisiologicos` | Booleano ($0$ / $1$) | Evita repetir la misma alerta. |

---

## 4. Vector de Características y Z-Score

### Vector de referencia

$$\mathbf{x} = \begin{bmatrix} x_1 & x_2 & x_3 \end{bmatrix}^T \in \mathbb{R}^{3}$$

Cada señal se compara **solo con su propia referencia**, porque tienen unidades distintas.

### Cálculo del Z-score

$$Z = \frac{x_{\text{medido}} - \mu_{\text{base}}}{\sigma_{\text{base}}}$$

Ejemplo para la frecuencia cardíaca:

$$Z_{\text{FC}} = \frac{\text{hr\_sleep} - \mu_{\text{HR}}}{\sigma_{\text{HR}}}$$

Se aplica el mismo procedimiento a la HRV y a la temperatura cutánea.

### Dirección esperada de cada señal

| Señal | Se considera fuera de rango si | Condición |
| :--- | :--- | :--- |
| FC nocturna | Sube | $Z_{\text{FC}} > 1.5$ |
| HRV nocturna | Baja | $Z_{\text{HRV}} < -1.5$ |
| Temperatura cutánea | Sube | $Z_{\text{Tpiel}} > 1.5$ |

> El umbral de $1.5$ coincide con el límite del rango normal de la Parte I. Es un **valor inicial de prueba** y debe validarse antes de usarse en una misión real.

---

## 5. Reglas de Validez de las Mediciones

Una señal solo se evalúa en una noche si cumple lo siguiente. Una medición ausente **nunca** se interpreta como desviación.

| Señal | Es válida si |
| :--- | :--- |
| `medicion_fc_valida` | Hubo ventana de sueño (`sleep_flag = 1`) con suficientes muestras PPG y poco movimiento (`motion = 0`). |
| `medicion_hrv_valida` | Se cumple lo anterior **y** el reloj entregó HRV para esa noche. |
| `medicion_temp_valida` | Hubo ventana de sueño con lectura de temperatura cutánea y, si hay API, `api_cabin_temp_c` dentro del rango de confort configurado (ejemplo ilustrativo: $20$ a $26\,^\circ\text{C}$). |

**Regla de la noche:** la noche solo se evalúa si hay **al menos 2 señales válidas**. Si hay menos, esa noche no suma ni reinicia el contador.

---

## 6. Regla de Detección en C y Sugerencia Operativa

### Evento 1: Cambios Fisiológicos Persistentes

**Objetivo:** detectar si al menos 2 de las 3 señales se desvían en la dirección esperada durante 3 noches consecutivas.

```c
// Se ejecuta UNA vez por noche, al cerrar la ventana de sueño.
// Los Z-scores y los flags de validez se calculan antes.

int validas = 0;
int fuera_base = 0;

if (medicion_fc_valida) {
    validas++;
    if (Z_FC > 1.5) fuera_base++;      // FC sube
}

if (medicion_hrv_valida) {
    validas++;
    if (Z_HRV < -1.5) fuera_base++;    // HRV baja
}

if (medicion_temp_valida) {
    validas++;
    if (Z_Tpiel > 1.5) fuera_base++;   // Temperatura cutánea sube
}

// Con menos de 2 señales válidas, la noche no se evalúa.
if (validas >= 2) {
    if (fuera_base >= 2) {
        noches_desviadas++;
    } else {
        noches_desviadas = 0;
        alerta_cambios_fisiologicos = 0;
    }
}

// 3 noches consecutivas con al menos 2 señales fuera de rango generan la alerta.
if (noches_desviadas >= 3 && alerta_cambios_fisiologicos == 0) {
    mostrar_mensaje_pantalla("Cambios fisiologicos persistentes en 3 noches. Registre como se siente y avise al oficial medico.");
    emitir_vibracion_haptica();
    alerta_cambios_fisiologicos = 1;
}
```

> **Sugerencia de acción:** Registrar cómo se siente (síntomas, apetito, cansancio, calidad del sueño), revisar si hubo cambios recientes de actividad, horario o temperatura de cabina, y comunicar el aviso al oficial médico para su seguimiento. Esta alerta **no indica la causa** del cambio.

### Funcionamiento paso a paso

1. Al terminar la ventana de sueño, el reloj calcula FC, HRV y temperatura cutánea de la noche.
2. Verifica qué señales son válidas.
3. Calcula el Z-score de cada una contra su línea de base personal.
4. Cuenta cuántas señales se desviaron en la dirección esperada.
5. Si fueron 2 o más, suma una noche al contador; si no, lo reinicia.
6. Con 3 noches consecutivas, genera la alerta una sola vez.

> **Variante opcional:** si reiniciar el contador por una sola noche normal resulta demasiado estricto, se puede exigir "3 de las últimas 4 noches".

---

## 7. Fundamento y Limitaciones

El módulo usa únicamente sensores que ya forman parte del smartwatch. No requiere sensores inmunológicos especializados ni análisis clínicos.

Las tres señales son **indicadores fisiológicos indirectos** y pueden cambiar por muchos motivos:

- **FC y HRV:** actividad física, estrés, calidad del sueño, cafeína o alimentación.
- **Temperatura cutánea:** además depende de la temperatura de la cabina, la ropa y el lugar de descanso. Por eso es la señal más sensible al ambiente y es la única que usa la API opcional.

Por lo tanto, **una alerta no significa que el sistema inmunitario esté alterado**. Solo indica que varias señales se alejaron de la referencia personal durante varias noches seguidas y conviene darles seguimiento.

La detección directa de cambios inmunitarios requeriría herramientas adicionales que no forman parte de las capacidades actuales del reloj.

> **Pendiente de validación:** umbral de $1.5$, número de noches (3), duración del período de calibración (14 noches) y rango de confort de cabina. Todos son valores iniciales de prueba.
