import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';

// --- CONNECTION ---
const socket = io("https://gumble-backend.onrender.com");

function App() {
  const [user, setUser] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [buyIn, setBuyIn] = useState(100);

  // --- AUTH ---
  const handleAuth = async (e) => {
    e.preventDefault();
    const endpoint = isRegistering ? 'register' : 'login';
    const payload = { username: e.target.username.value, password: e.target.password.value };
    
    try {
        const res = await fetch(`https://gumble-backend.onrender.com/api/${endpoint}`, {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) setUser(data);
        else alert(data.error || "Login Failed");
    } catch (err) { alert("Backend Offline!"); }
  };

  // --- GAME ---
  useEffect(() => {
    socket.on('gameState', (data) => {
        setGameState(data);
    });
  }, []);

  const joinGame = () => {
    if (user.balance < buyIn) { alert("Insufficient funds!"); return; }
    socket.emit('joinGame', { userId: user._id, buyIn });
  };

  const sendAction = (type, amount = 0) => {
    socket.emit('action', { type, amount });
  };

  // --- RENDER: LOGIN ---
  if (!user) return (
    <div className="login-screen">
        <div className="login-box">
            <h1 className="logo">GUMBLE<span className="gold">STAKE</span></h1>
            <p className="subtitle">HIGH STAKES POKER</p>
            <form onSubmit={handleAuth}>
                <input className="lux-input" name="username" placeholder="Username" required />
                <input className="lux-input" name="password" type="password" placeholder="Password" required />
                <button className="gold-btn">{isRegistering ? "REGISTER" : "LOGIN"}</button>
            </form>
            <p className="toggle" onClick={() => setIsRegistering(!isRegistering)}>
                {isRegistering ? "Have an account? Login" : "Create Account"}
            </p>
        </div>
    </div>
  );

  // --- RENDER: LOBBY ---
  if (!gameState || !gameState.players.find(p => p.name === user.username)) return (
    <div className="lobby-screen">
        <div className="lobby-box">
            <h1>WELCOME, {user.username}</h1>
            <div className="balance-display">${user.balance}</div>
            
            <div className="stakes-box">
                <h3>SELECT BUY-IN</h3>
                <div className="buttons-row">
                    <button className={buyIn===20 ? "stake-btn active" : "stake-btn"} onClick={()=>setBuyIn(20)}>$20</button>
                    <button className={buyIn===100 ? "stake-btn active" : "stake-btn"} onClick={()=>setBuyIn(100)}>$100</button>
                </div>
                <button className="gold-btn big" onClick={joinGame}>JOIN TABLE</button>
            </div>
            <p style={{color: '#555', marginTop: '20px'}}>Room: {gameState ? gameState.roomId : "Loading..."}</p>
        </div>
    </div>
  );

  // --- RENDER: GAME ---
  const myPlayer = gameState.players.find(p => p.name === user.username);
  const isMyTurn = gameState.players[gameState.turnIndex]?.id === socket.id;

  return (
    <div className="game-screen">
        <div className="poker-table">
            
            {/* CENTER: POT & BOARD */}
            <div className="table-center">
                <div className="pot-pill">POT: ${gameState.pot}</div>
                <div className="community-cards">
                    {gameState.communityCards.map((c, i) => (
                        <div key={i} className="card">{c}</div>
                    ))}
                </div>
                {gameState.phase === 'showdown' && <div className="winner-msg">HAND OVER</div>}
            </div>

            {/* PLAYERS */}
            {gameState.players.map((p, i) => {
                const isMe = p.name === user.username;
                const isTurn = gameState.players[gameState.turnIndex]?.id === p.id;
                
                return (
                    <div key={i} className={`player-seat seat-${i} ${isTurn ? 'turn-active' : ''}`}>
                        <div className="avatar">{p.name[0]}</div>
                        <div className="player-stats">
                            <div className="p-name">{p.name}</div>
                            <div className="p-bal">${p.balance}</div>
                        </div>
                        <div className="hand">
                            {p.hand.map((c, j) => (
                                <div key={j} className={`card ${!isMe && gameState.phase !== 'showdown' ? 'back' : ''}`}>
                                    {isMe || gameState.phase === 'showdown' ? c : ''}
                                </div>
                            ))}
                        </div>
                        {p.currentBet > 0 && <div className="bet-chip">${p.currentBet}</div>}
                    </div>
                );
            })}
        </div>

        {/* CONTROLS */}
        <div className={`controls-bar ${!isMyTurn ? 'disabled' : ''}`}>
             <button className="action-btn fold" onClick={() => sendAction('fold')}>FOLD</button>
             <button className="action-btn check" onClick={() => sendAction('call')}>CHECK / CALL</button>
             <button className="action-btn raise" onClick={() => sendAction('raise', 20)}>RAISE $20</button>
             {!isMyTurn && <div className="wait-overlay">WAITING FOR OPPONENT...</div>}
        </div>
    </div>
  );
}

export default App;