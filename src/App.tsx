import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';

const Home = lazy(() => import('pages/Home'));
const Server = lazy(() => import('pages/Video/Video'));

const Video = lazy(() => import('layouts/Video'));

function App() {
  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            <Suspense fallback>
              <Home />
            </Suspense>
          }
        />

        <Route
          path="/video"
          element={
            <Suspense fallback>
              <Video />
            </Suspense>
          }
        >
          <Route
            path="server"
            element={
              <Suspense fallback>
                <Server />
              </Suspense>
            }
          />
          <Route
            path="client"
            element={
              <Suspense fallback>
                <Server type="client" />
              </Suspense>
            }
          />
        </Route>
      </Routes>
    </>
  );
}

export default App;
