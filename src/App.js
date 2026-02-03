import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';

const socket = io("https://gumble-backend.onrender.com");

function App() {
  const [user, setUser] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [buyIn, setBuyIn] = useState(100);

  // AUTH LOGIC
  const handleLogin = async (e) => {
    e.preventDefault();
    const res = await fetch('https://gumble-backend.onrender.com/api/login', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({username: e.target.username.value, password: e.target.password.value})
    });
    const data = await res.json();
    if (res.ok) setUser(data);
    else alert(data.error);
  };

  // GAME LISTENERS
  useEffect(() => {
    socket.on('gameState', (data) => {
        setGameState(data);
    });
  }, []);

  const joinGame = () => {
    socket.emit('joinGame', { userId: user._id, buyIn });
  };

  const sendAction = (type, amount = 0) => {
    socket.emit('action', { type, amount });
  };

  // 1. LOGIN SCREEN
  if (!user) return (
    <div className="login-container">
        <div className="login-card">
            <h1>GUMBLE<span className="gold">STAKE</span></h1>
            <form onSubmit={handleLogin}>
                <input className="lux-input" name="username" placeholder="User" />
                <input className="lux-input" name="password" type="password" placeholder="Pass" />
                <button className="gold-btn">ENTER CASINO</button>
            </form>
            <p style={{color:'#666', marginTop:'10px'}}>Use user "stv" (created earlier)</p>
        </div>
    </div>
  );

  // 2. LOBBY
  if (!gameState) return (
      <div className="dashboard-container">
          <h1>Welcome {user.username}</h1>
          <button className="gold-btn" onClick={joinGame}>SIT AT TABLE ($100)</button>
      </div>
  );

  // 3. GAME TABLE
  const mySeat = gameState.players.find(p => p.name === user.username);
  const isMyTurn = gameState.players[gameState.turnIndex]?.id === socket.id;

  return (
    <div className="game-container">
      <div className="poker-table">
        {/* POT & COMMUNITY CARDS */}
        <div className="center-area">
            <div className="pot-badge">POT: ${gameState.pot}</div>
            <div className="community-cards">
                {gameState.communityCards.map((c, i) => 
                    <div key={i} className="card">{c}</div>
                )}
            </div>
            {gameState.phase === 'showdown' && <div className="winner-banner">SHOWDOWN!</div>}
        </div>

        {/* PLAYERS */}
        {gameState.players.map((p, i) => (
            <div key={i} className={`player-seat seat-${i} ${gameState.turnIndex === i ? 'active-turn' : ''}`}>
                <div className="avatar">{p.name[0]}</div>
                <div className="player-info">
                    <div>{p.name}</div>
                    <div style={{color: '#2ecc71'}}>${p.balance}</div>
                </div>
                <div className="hand">
                    {/* Hide cards if not me and not showdown */}
                    {p.hand.map((c, j) => 
                        <div key={j} className={`card ${p.name !== user.username && gameState.phase !== 'showdown' ? 'back' : ''}`}>
                            {p.name === user.username || gameState.phase === 'showdown' ? c : ''}
                        </div>
                    )}
                </div>
                {p.currentBet > 0 && <div className="chip-stack">Bet: ${p.currentBet}</div>}
            </div>
        ))}
      </div>

      {/* CONTROLS (Only show if sitting and my turn) */}
      {mySeat && (
          <div className={`controls-panel ${!isMyTurn ? 'disabled' : ''}`}>
              {!isMyTurn && <div className="turn-overlay">WAITING FOR TURN...</div>}
              <button className="action-btn check" onClick={() => sendAction('call')}>CALL / CHECK</button>
              <button className="action-btn fold" onClick={() => sendAction('fold')}>FOLD</button>
              <button className="action-btn raise" onClick={() => sendAction('raise', 20)}>RAISE $20</button>
          </div>
      )}
    </div>
  );
}

export default App;