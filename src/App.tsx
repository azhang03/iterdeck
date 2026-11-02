import { Route, Routes } from 'react-router-dom'
import Home from './pages/Home.tsx'
import Folders from './pages/Folders.tsx'
import Sets from './pages/Sets.tsx'
import Folder from './pages/Folder.tsx'
import Set from './pages/Set.tsx'
import Editor from './pages/Editor.tsx'
import Flashcards from './pages/Flashcards.tsx'
import Learn from './pages/Learn.tsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/folders" element={<Folders />} />
      <Route path="/sets" element={<Sets />} />
      <Route path="/folders/:id" element={<Folder />} />
      <Route path="/sets/:id" element={<Set />} />
      <Route path="/sets/:id/edit" element={<Editor />} />
      <Route path="/sets/:id/flashcards" element={<Flashcards />} />
      <Route path="/sets/:id/learn" element={<Learn />} />
    </Routes>
  )
}
