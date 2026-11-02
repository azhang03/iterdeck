import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router-dom'
import Layout from './components/Layout.tsx'
import Home from './pages/Home.tsx'
import Folders from './pages/Folders.tsx'
import Sets from './pages/Sets.tsx'
import Folder from './pages/Folder.tsx'
import Set from './pages/Set.tsx'
import Editor from './pages/Editor.tsx'
import Flashcards from './pages/Flashcards.tsx'
import Learn from './pages/Learn.tsx'

// A data router, so pages can block navigation with useBlocker (the editor's unsaved guard).
const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/folders" element={<Folders />} />
        <Route path="/sets" element={<Sets />} />
        <Route path="/folders/:id" element={<Folder />} />
        <Route path="/sets/:id" element={<Set />} />
        <Route path="/sets/:id/edit" element={<Editor />} />
      </Route>
      <Route path="/sets/:id/flashcards" element={<Flashcards />} />
      <Route path="/sets/:id/learn" element={<Learn />} />
    </>,
  ),
)

export default function App() {
  return <RouterProvider router={router} />
}
