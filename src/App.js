import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';

// YOUR RENDER BACKEND URL
const socket = io("https://gumble-backend.onrender.com");

function App() {
  const [user, setUser] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false); // Toggle Login/Register
  const [room, setRoom] = useState("HighRollers");
  const [gameState, setGameState] = useState(null);
  const [buyIn, setBuyIn] = useState(20);

  // Check for Invite Link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('room')) setRoom(params.get('room'));
  }, []);

  // Handle Login & Register
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
      
      if (res.ok) {
        setUser(data);
      } else {
        alert(data.error || "Authentication Failed. Check Backend Logs.");
      }
    } catch (err) {
      alert("Cannot connect to server! Is your Backend running on Render?");
    }
  };

  const joinTable = () => {
    if (user.balance < buyIn) {
      alert("Insufficient Funds! Please deposit.");
      return;
    }
    socket.emit('joinGame', { roomId: room, userId: user._id, buyIn });
  };

  // LISTENER: Game Updates
  useEffect(() => {
    socket.on('gameState', (data) => {
      // Privacy Filter: Only show my cards
      const myView = { ...data };
      myView.players = data.players.map(p => ({
        ...p,
        hand: (p.id === socket.id || data.phase === 'showdown') ? p.hand : ['XX', 'XX']
      }));
      setGameState(myView);
    });
  }, []);

  // --- VIEW 1: LOGIN / REGISTER ---
  if (!user) return (
    <div className="login-screen">
      <div className="login-box">
        <h1 className="brand-title"><span className="gold">G</span>UMBLE</h1>
        <form onSubmit={handleAuth}>
          <input name="username" placeholder="Username" required />
          <input name="password" type="password" placeholder="Password" required />
          
          <button className="luxury-btn full-width">
            {isRegistering ? "CREATE ACCOUNT" : "LOGIN"}
          </button>
          
          <p className="switch-mode" onClick={() => setIsRegistering(!isRegistering)}>
            {isRegistering ? "Already have an account? Login" : "Need an account? Register"}
          </p>
          
          <button type="button" className="google-btn">Login with Gmail</button>
        </form>
      </div>
    </div>
  );

  // --- VIEW 2: DASHBOARD ---
  if (!gameState) return (
    <div className="dashboard">
      <div className="header">
        <h1>Welcome, <span className="gold">{user.username}</span></h1>
        <div className="balance-box">Balance: <span className="green">${user.balance}</span></div>
      </div>
      
      <div className="menu-box">
        <h3>Select Stakes</h3>
        <div className="stakes">
          <button className={`stake-btn ${buyIn === 20 ? 'active' : ''}`} onClick={() => setBuyIn(20)}>$20 Buy-in</button>
          <button className={`stake-btn ${buyIn === 100 ? 'active' : ''}`} onClick={() => setBuyIn(100)}>$100 Buy-in</button>
        </div>
        <button className="luxury-btn big" onClick={joinTable}>SIT AT TABLE</button>
        <div className="invite-box">
          <p>Invite Friend:</p>
          <input readOnly value={`gumble.com/?room=${room}`} />
        </div>
      </div>
    </div>
  );

  // --- VIEW 3: POKER TABLE ---
  return (
    <div className="game-screen">
      <div className="poker-table">
        <div className="pot-display">POT: ${gameState.pot}</div>
        <div className="community-cards">
            {gameState.communityCards.map((c, i) => 
              <div key={i} className={`card ${c === 'XX' ? 'back' : ''}`}>{c !== 'XX' ? c : ''}</div>
            )}
        </div>
        
        {gameState.players.map(p => (
            <div key={p.id} className={`player-seat ${p.id === socket.id ? 'me' : ''}`}>
                <div className="avatar-circle">{p.name[0].toUpperCase()}</div>
                <div className="player-info">
                  <span className="p-name">{p.name}</span>
                  <span className="p-bal">${p.balance}</span>
                </div>
                <div className="hand">
                    {p.hand.map((c, i) => 
                      <div key={i} className={`small-card ${c === 'XX' ? 'back' : ''}`}>{c !== 'XX' ? c : ''}</div>
                    )}
                </div>
            </div>
        ))}
      </div>

      <div className="controls-bar">
          <button className="action-btn check" onClick={() => socket.emit('action', {roomId: room, type: 'check'})}>CHECK</button>
          <button className="action-btn fold" onClick={() => socket.emit('action', {roomId: room, type: 'fold'})}>FOLD</button>
          <button className="action-btn raise" onClick={() => socket.emit('action', {roomId: room, type: 'raise', amount: 20})}>RAISE $20</button>
      </div>
    </div>
  );
}

export default App;