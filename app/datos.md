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