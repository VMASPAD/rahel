/**
 * usePageMeta — SEO por ruta para la SPA (sin dependencias).
 *
 * API:
 *   usePageMeta({ title, description?, path?, noindex?, image? })
 *     Hook: llamarlo en el cuerpo de una página/componente de ruta.
 *       - title:       <title> y og:title / twitter:title (se añade " · RaHel" si falta)
 *       - description: meta description, og:description, twitter:description (<=160 car.)
 *       - path:        ruta canónica (por defecto location.pathname). Se combina con SITE_URL.
 *       - noindex:     fuerza robots "noindex,nofollow". Rutas /app y /app/* son noindex
 *                      automáticamente aunque no se indique.
 *       - image:       URL o ruta de imagen OG (por defecto /og-image.png)
 *     Al desmontar restaura los valores previos del index.html.
 *
 *   <PageMeta title="..." description="..." />   (exportado como función PageMeta)
 *     Versión declarativa: no renderiza nada (devuelve null). Usar con createElement/JSX
 *     dentro de una página: <PageMeta title="Panel" noindex />
 *
 *   SITE_URL: origen de producción (VITE_SITE_URL, por defecto https://rahel.hermesbackend.xyz).
 *   absoluteUrl(path): construye URL absoluta contra SITE_URL.
 *
 * Ejemplo:
 *   usePageMeta({ title: 'RaHel — Monitoreo de salud de tripulantes', description: '...' })
 */
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export const SITE_URL: string = (
  (import.meta.env.VITE_SITE_URL as string | undefined) || 'https://rahel.hermesbackend.xyz'
).replace(/\/+$/, '')

const SITE_NAME = 'RaHel'
const DEFAULT_IMAGE = '/og-image.png'

export interface PageMetaOptions {
  title: string
  description?: string
  path?: string
  noindex?: boolean
  image?: string
}

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  return SITE_URL + (path.startsWith('/') ? path : `/${path}`)
}

function isPrivatePath(pathname: string): boolean {
  return pathname === '/app' || pathname.startsWith('/app/')
}

type Attr = 'name' | 'property'

function setMeta(attr: Attr, key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setCanonical(href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

function getMeta(attr: Attr, key: string): string | null {
  return document.head.querySelector(`meta[${attr}="${key}"]`)?.getAttribute('content') ?? null
}

export function usePageMeta(opts: PageMetaOptions): void {
  const { pathname } = useLocation()
  const { title, description, path, noindex, image } = opts

  useEffect(() => {
    const prevTitle = document.title
    const prevDesc = getMeta('name', 'description')
    const prevRobots = getMeta('name', 'robots')
    const prevCanonical = document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')

    const canonicalPath = path ?? pathname
    const url = absoluteUrl(canonicalPath)
    const fullTitle = title.includes(SITE_NAME) ? title : `${title} · ${SITE_NAME}`
    const isPrivate = noindex || isPrivatePath(pathname)

    document.title = fullTitle
    if (description) {
      setMeta('name', 'description', description)
      setMeta('property', 'og:description', description)
      setMeta('name', 'twitter:description', description)
    }
    setMeta('property', 'og:title', fullTitle)
    setMeta('name', 'twitter:title', fullTitle)
    setMeta('property', 'og:url', url)
    setMeta('property', 'og:image', absoluteUrl(image ?? DEFAULT_IMAGE))
    setMeta('name', 'twitter:image', absoluteUrl(image ?? DEFAULT_IMAGE))
    setMeta('name', 'robots', isPrivate ? 'noindex,nofollow' : 'index,follow')
    setCanonical(isPrivate ? absoluteUrl('/') : url)

    return () => {
      document.title = prevTitle
      if (prevDesc !== null) setMeta('name', 'description', prevDesc)
      if (prevRobots !== null) setMeta('name', 'robots', prevRobots)
      if (prevCanonical) setCanonical(prevCanonical)
    }
  }, [title, description, path, noindex, image, pathname])
}

/** Versión declarativa: <PageMeta title="..." description="..." /> */
export function PageMeta(props: PageMetaOptions): null {
  usePageMeta(props)
  return null
}
