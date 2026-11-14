import { useState } from 'react'
import Orb from './Orb'

function hasWebGL2() {
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2')
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return !!gl
  } catch {
    return false
  }
}

/** Esfera 3D (React Bits Orb) que late a ~72 lpm. Sin WebGL2 cae a un orbe CSS. */
export default function HeartOrb() {
  const [ok] = useState(hasWebGL2)
  const [reduce] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  return (
    <div className="lp-pulse">
      <span className="lp-pulse-halo" aria-hidden="true" />
      <span className="lp-pulse-halo lp-pulse-halo-2" aria-hidden="true" />
      <div className="lp-orb-stage">
        {ok ? (
          <Orb
            colors={['#007A39', '#5EE0A0', '#FFE5E7']}
            backgroundColor="#04281A"
            glow={1.6}
            bleed={3}
            size={1.12}
            wobble={1.4}
            speed={0.8}
            hoverIntensity={0.8}
            paused={reduce}
            dpr={Math.min(window.devicePixelRatio || 1, 1.5)}
          />
        ) : (
          <div className="lp-orb-fallback" />
        )}
      </div>
    </div>
  )
}
