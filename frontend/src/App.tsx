import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing'

const AppPage = lazy(() => import('./pages/AppPage'))
const Analytics = lazy(() => import('./pages/Analytics'))

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/app"
          element={
            <Suspense fallback={<main className="page"><p className="muted">Cargando panel…</p></main>}>
              <AppPage />
            </Suspense>
          }
        />
        <Route
          path="/app/analitica"
          element={
            <Suspense fallback={<main className="page"><p className="muted">Cargando analítica…</p></main>}>
              <Analytics />
            </Suspense>
          }
        />
        <Route path="*" element={<Landing />} />
      </Routes>
    </BrowserRouter>
  )
}
