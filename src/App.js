import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';

const socket = io("https://gumble-backend.onrender.com");

// Helper to get Real Card Image
const getCardSrc = (code) => {
    if (!code || code === 'XX') return "https://www.deckofcardsapi.com/static/img/back.png";
    // Convert 'T' to '0' for API if needed, backend uses 0 for Ten
    let rank = code[0];
    let suit = code[1];
    return `https://www.deckofcardsapi.com/static/img/${rank}${suit}.png`;
};

function App() {
  const [user, setUser] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [buyIn, setBuyIn] = useState(100);
  const [raiseAmount, setRaiseAmount] = useState(20);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // AUTH
  const handleAuth = async (e) => {
    e.preventDefault();
    const endpoint = isRegistering ? 'register' : 'login';
    try {
        const res = await fetch(`https://gumble-backend.onrender.com/api/${endpoint}`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username: e.target.username.value, password: e.target.password.value})
        });
        const data = await res.json();
        if (res.ok) setUser(data);
        else alert(data.error);
    } catch(err) { alert("Server Offline"); }
  };

  // GAME EVENTS
  useEffect(() => {
    socket.on('gameState', setGameState);
    return () => socket.off('gameState');
  }, []);

  const joinGame = () => {
      socket.emit('joinGame', { userId: user._id, buyIn });
  };
  const leaveGame = () => {
      socket.emit('leaveGame');
      setGameState(null); // Return to lobby
  };
  const copyInvite = () => {
      navigator.clipboard.writeText(window.location.href);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
  };

  // 1. LOGIN
  if (!user) return (
      <div className="login-screen">
          <div className="login-box">
              <h1 className="logo">GUMBLE<span className="gold">STAKE</span></h1>
              <form onSubmit={handleAuth}>
                  <input className="lux-input" name="username" placeholder="Username" required />
                  <input className="lux-input" name="password" type="password" placeholder="Password" required />
                  <button className="gold-btn">{isRegistering ? "REGISTER" : "LOGIN"}</button>
              </form>
              <p className="toggle" onClick={()=>setIsRegistering(!isRegistering)}>
                  {isRegistering ? "Back to Login" : "Create Account"}
              </p>
          </div>
      </div>
  );

  // 2. LOBBY (If not seated)
  const mySeat = gameState?.players.find(p => p.name === user.username);
  if (!gameState || !mySeat) return (
      <div className="lobby-screen">
          <div className="lobby-box">
              <h1>WELCOME, {user.username}</h1>
              <div className="balance-display">Bank: ${user.balance}</div>
              <div className="stakes-box">
                  <p>Select Buy-in:</p>
                  <div className="btn-row">
                      <button onClick={()=>setBuyIn(50)} className={buyIn===50?"active":""}>$50</button>
                      <button onClick={()=>setBuyIn(100)} className={buyIn===100?"active":""}>$100</button>
                  </div>
                  <button className="gold-btn big" onClick={joinGame}>SIT AT TABLE</button>
              </div>
          </div>
      </div>
  );

  // 3. TABLE
  const isMyTurn = gameState.players[gameState.turnIndex]?.id === socket.id;
  
  return (
    <div className="game-screen">
        <div className="header-bar">
            <button className="leave-btn" onClick={leaveGame}>LEAVE TABLE</button>
            <button className="invite-btn" onClick={copyInvite}>
                {inviteCopied ? "COPIED!" : "INVITE LINK"}
            </button>
        </div>

        <div className="poker-table">
            <div className="table-center">
                <div className="pot-pill">POT: ${gameState.pot}</div>
                <div className="community-cards">
                    {gameState.communityCards.map((c, i) => (
                        <img key={i} src={getCardSrc(c)} className="real-card" alt={c} />
                    ))}
                </div>
                {gameState.phase === 'showdown' && <div className="winner-msg">SHOWDOWN!</div>}
            </div>

            {gameState.players.map((p, i) => {
                const isMe = p.name === user.username;
                const isTurn = gameState.players[gameState.turnIndex]?.id === p.id;
                return (
                    <div key={i} className={`seat seat-${i} ${isTurn ? 'active-turn' : ''}`}>
                         {isTurn && <div className="timer-bar" style={{width: `${(gameState.timer/30)*100}%`}}></div>}
                         <div className="avatar">{p.name[0]}</div>
                         <div className="p-info">
                             <div className="p-name">{p.name}</div>
                             <div className="p-bal">${p.balance}</div>
                         </div>
                         <div className="hand">
                             {p.hand.map((c, j) => (
                                 <img key={j} src={getCardSrc(!isMe && gameState.phase !== 'showdown' ? 'XX' : c)} 
                                      className="real-card small" alt="card" />
                             ))}
                         </div>
                         {p.currentBet > 0 && <div className="bet-bubble">${p.currentBet}</div>}
                    </div>
                );
            })}
        </div>

        {/* CONTROLS */}
        <div className={`controls-dock ${!isMyTurn ? 'disabled' : ''}`}>
            <div className="slider-box">
                <input type="range" min={gameState.highestBet + 10} max={mySeat.balance} 
                       value={raiseAmount} onChange={(e)=>setRaiseAmount(Number(e.target.value))} />
                <span>Raise: ${raiseAmount}</span>
            </div>
            <div className="action-btns">
                <button className="act-btn fold" onClick={()=>socket.emit('action', {type:'fold'})}>FOLD</button>
                <button className="act-btn check" onClick={()=>socket.emit('action', {type:'call'})}>CALL / CHECK</button>
                <button className="act-btn raise" onClick={()=>socket.emit('action', {type:'raise', amount: raiseAmount})}>RAISE</button>
            </div>
            {!isMyTurn && <div className="overlay">WAITING FOR TURN...</div>}
        </div>
    </div>
  );
}

export default App;