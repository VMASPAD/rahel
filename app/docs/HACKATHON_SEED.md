# Datos SEED — RaHel

Perfiles simulados para la demo del hackathon (sin sensores reales):

| Perfil | ID | Qué demuestra |
|--------|-----|----------------|
| Tripulación nominal | `healthy_crew` | Estado verde, sin alertas |
| Pérdida ósea temprana | `early_bone_demineralization` | Baja actividad → riesgo BONE |
| Sueño / estrés | `sleep_deprivation_stress` | HRV baja, aislamiento → BEHAVIORAL |
| Estrés cardiovascular | `cardiovascular_strain` | FC reposo alta, SpO₂ algo baja → CARDIO |
| Inmunidad (proxy) | `immune_suppression_proxy` | Sueño + estrés + HRV → IMMUNE |

En la app: **Demo SEED** en la pantalla principal.

Los perfiles están calibrados para disparar reglas inspiradas en evidencia HRP (p. ej. sueño &lt; 6 h → conductual; pasos bajos → proxy de carga ósea). Detalle en `docs/RESEARCH_NOTES.md`.
