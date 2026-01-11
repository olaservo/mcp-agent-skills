import { TerminalChat } from './components/TerminalChat'

function App() {
  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <TerminalChat wsEndpoint="ws://localhost:3001/ws" />
    </div>
  )
}

export default App
