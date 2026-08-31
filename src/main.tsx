import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { GameServerProvider } from '@agent8/gameserver'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GameServerProvider>
      <App />
    </GameServerProvider>
  </StrictMode>,
)
