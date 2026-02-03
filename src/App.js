import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css'; // This connects the design

// YOUR RENDER BACKEND URL
const socket = io("https://gumble-backend.onrender.com");

function App() {
  const [user, setUser] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [room, setRoom] = useState("HighRollers");
  const [gameState, setGameState] = useState(null);
  const [buyIn, setBuyIn] = useState(20);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('room')) setRoom(params.get('room'));
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    const username = e.target.username.value;
    const password = e.target.password.value;
    const endpoint = isRegistering ? 'register' : 'login';

    try {
      const res = await fetch(`https://gumble-backend.onrender.com/api/${endpoint}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({username, password})
      });
      const data = await res.json();
      if (res.ok) setUser(data);
      else alert(data.error);
    } catch (err) {
      alert("Server error. Please try again.");
    }
  };

  const joinTable = () => {
    socket.emit('joinGame', { roomId: room, userId: user._id, buyIn });
  };

  useEffect(() => {
    socket.on('gameState', (data) => {
      const myView = { ...data };
      myView.players = data.players.map(p => ({
        ...p,
        hand: (p.id === socket.id || data.phase === 'showdown') ? p.hand : ['XX', 'XX']
      }));
      setGameState(myView);
    });
  }, []);

  // --- 1. LUXURY LOGIN SCREEN ---
  if (!user) return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="logo">GUMBLE<span className="gold">STAKE</span></h1>
        <p className="subtitle">PREMIUM POKER LOUNGE</p>
        
        <form onSubmit={handleAuth}>
          <input className="lux-input" name="username" placeholder="Username" required />
          <input className="lux-input" name="password" type="password" placeholder="Password" required />
          
          <button className="gold-btn full-width">
            {isRegistering ? "CREATE VIP ACCOUNT" : "ENTER LOUNGE"}
          </button>
        </form>
        
        <p className="toggle-text" onClick={() => setIsRegistering(!isRegistering)}>
          {isRegistering ? "Return to Login" : "Apply for Membership (Register)"}
        </p>
      </div>
    </div>
  );

  // --- 2. DASHBOARD ---
  if (!gameState) return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Welcome, {user.username}</h1>
        <div className="balance-badge">${user.balance}</div>
      </div>

      <div className="dashboard-menu">
        <h3>SELECT STAKES</h3>
        <div className="stakes-row">
          <button className={buyIn === 20 ? "stake-btn active" : "stake-btn"} onClick={() => setBuyIn(20)}>$20</button>
          <button className={buyIn === 100 ? "stake-btn active" : "stake-btn"} onClick={() => setBuyIn(100)}>$100</button>
        </div>
        <button className="gold-btn big" onClick={joinTable}>JOIN TABLE</button>
        
        <div className="invite-section">
          <p>Invite Link:</p>
          <div className="invite-link">gumble-poker.onrender.com/?room={room}</div>
        </div>
      </div>
    </div>
  );

  // --- 3. POKER TABLE ---
  return (
    <div className="game-container">
      <div className="poker-table">
        <div className="pot-container">
            <span className="pot-label">POT</span>
            <span className="pot-amount">${gameState.pot}</span>
        </div>

        <div className="community-row">
            {gameState.communityCards.map((c, i) => 
              <div key={i} className={`card ${c === 'XX' ? 'back' : ''}`}>{c !== 'XX' ? c : ''}</div>
            )}
        </div>
        
        {gameState.players.map(p => (
            <div key={p.id} className={`player-seat ${p.id === socket.id ? 'me' : 'opponent'}`}>
                <div className="avatar">{p.name[0].toUpperCase()}</div>
                <div className="player-details">
                    <div className="name">{p.name}</div>
                    <div className="balance">${p.balance}</div>
                </div>
                <div className="hand">
                    {p.hand.map((c, i) => 
                      <div key={i} className={`card small ${c === 'XX' ? 'back' : ''}`}>{c !== 'XX' ? c : ''}</div>
                    )}
                </div>
            </div>
        ))}
      </div>

      <div className="controls-panel">
          <button className="action-btn check" onClick={() => socket.emit('action', {roomId: room, type: 'check'})}>CHECK</button>
          <button className="action-btn fold" onClick={() => socket.emit('action', {roomId: room, type: 'fold'})}>FOLD</button>
          <button className="action-btn raise" onClick={() => socket.emit('action', {roomId: room, type: 'raise', amount: 20})}>RAISE</button>
      </div>
    </div>
  );
}

export default App;