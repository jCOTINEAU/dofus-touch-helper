import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'

// Demande la persistance du stockage au plus tôt (IndexedDB = seule
// source de données de l'app).
void navigator.storage?.persist?.()

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
