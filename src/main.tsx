import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { GameServerProvider } from '@agent8/gameserver'
import App from './App.tsx'
import { detectLang, loadLang } from './i18n'

/*
 * The player's own language, before anything is drawn.
 *
 * The dictionaries are fetched rather than bundled, and the loading screen has
 * words on it — so the one word the game opens with should not be in English
 * for whoever is not reading English. The markup in index.html stays up while
 * this is in flight, which is a fraction of a second and already on screen.
 */
void loadLang(detectLang()).then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <GameServerProvider>
        <App />
      </GameServerProvider>
    </StrictMode>,
  )
})
