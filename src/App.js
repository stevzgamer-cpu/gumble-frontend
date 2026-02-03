import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';

// CHANGE THIS TO YOUR RENDER URL
const socket = io("https://gumble-backend.onrender.com");

function App() {
  const [user, setUser] = useState(null); // Auth User
  const [room, setRoom] = useState("HighRollers");
  const [gameState, setGameState] = useState(null);
  const [buyIn, setBuyIn] = useState(50);

  // 1. Login Logic
  const handleLogin = async (e) => {
    e.preventDefault();
    const username = e.target.username.value;
    const password = e.target.password.value;
    // Call API (Simulated for speed)
    const res = await fetch('https://gumble-backend.onrender.com/api/login', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({username, password})
    });
    const data = await res.json();
    if (data.username) setUser(data);
  };

  // 2. Game Logic
  useEffect(() => {
    socket.on('gameState', (data) => {
      // PRIVACY FILTER: Hide opponent cards locally if backend didn't
      const myView = { ...data };
      myView.players = data.players.map(p => ({
        ...p,
        hand: (p.id === socket.id || data.phase === 'showdown') ? p.hand : ['??', '??']
      }));
      setGameState(myView);
    });
  }, []);

  const joinTable = () => {
    socket.emit('joinGame', { roomId: room, userId: user._id, buyIn });
  };

  // 3. Render Views
  if (!user) return (
    <div className="login-screen">
      <h1><span style={{color:'gold'}}>G</span>UMBLE</h1>
      <form onSubmit={handleLogin}>
        <input name="username" placeholder="Username" />
        <input name="password" type="password" placeholder="Password" />
        <button className="luxury-btn">Login</button>
        <button type="button" className="google-btn">Login with Gmail</button>
      </form>
    </div>
  );

  if (!gameState) return (
    <div className="dashboard">
      <h1>Welcome, {user.username}</h1>
      <h2>Balance: ${user.balance}</h2>
      <div className="banking">
        <button onClick={() => setBuyIn(20)}>Buy-in $20</button>
        <button onClick={() => setBuyIn(100)}>Buy-in $100</button>
      </div>
      <button className="luxury-btn" onClick={joinTable}>JOIN TABLE</button>
      <p>Invite Link: gumble.com/?room={room}</p>
    </div>
  );

  return (
    <div className="game-screen">
      <div className="poker-table">
        <div className="community-cards">
            {gameState.communityCards.map((c, i) => <div key={i} className="card">{c}</div>)}
        </div>
        
        {gameState.players.map(p => (
            <div key={p.id} className={`player-seat ${p.id === socket.id ? 'me' : ''}`}>
                <div className="avatar">{p.name[0]}</div>
                <div className="cards">
                    {p.hand.map((c, i) => <div key={i} className={`card ${c === '??' ? 'hidden' : ''}`}>{c}</div>)}
                </div>
                <div className="chips">${p.balance}</div>
            </div>
        ))}
      </div>

      <div className="controls">
          <button className="luxury-btn" onClick={() => socket.emit('action', {roomId: room, type: 'check'})}>CHECK</button>
          <button className="luxury-btn" onClick={() => socket.emit('action', {roomId: room, type: 'fold'})}>FOLD</button>
          <button className="luxury-btn" onClick={() => socket.emit('action', {roomId: room, type: 'raise', amount: 20})}>RAISE $20</button>
      </div>
    </div>
  );
}

export default App;