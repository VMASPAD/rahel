import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing'

const AppLayout = lazy(() => import('./components/dashboard/AppLayout'))
const DemoLayout = lazy(() => import('./components/dashboard/DemoLayout'))
const AppPage = lazy(() => import('./pages/AppPage'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Analysis = lazy(() => import('./pages/Analysis'))

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/app"
          element={
            <Suspense fallback={<main className="page"><p className="muted">Loading dashboard…</p></main>}>
              <AppLayout />
            </Suspense>
          }
        >
          <Route index element={<AppPage />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="analysis" element={<Analysis />} />
          {/* Old Spanish addresses keep working for existing bookmarks. */}
          <Route path="analitica" element={<Navigate to="/app/analytics" replace />} />
          <Route path="analisis" element={<Navigate to="/app/analysis" replace />} />
        </Route>
        <Route
          path="/demo"
          element={
            <Suspense fallback={<main className="page"><p className="muted">Loading demo…</p></main>}>
              <DemoLayout />
            </Suspense>
          }
        >
          <Route index element={<AppPage />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="analysis" element={<Analysis />} />
          <Route path="analitica" element={<Navigate to="/demo/analytics" replace />} />
          <Route path="analisis" element={<Navigate to="/demo/analysis" replace />} />
        </Route>
        <Route path="*" element={<Landing />} />
      </Routes>
    </BrowserRouter>
  )
}
