import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';

const socket = io("https://gumble-backend.onrender.com");

// --- 🛠️ THE FIX IS HERE: FORCE UPPERCASE SUITS ---
const getCardSrc = (code) => {
    // If the code is missing or hidden, show the red back
    if (!code || code === 'XX') return "https://www.deckofcardsapi.com/static/img/back.png";
    
    // 1. Convert 'T' (Ten) to '0' because the API uses 0 for 10
    let rank = code[0] === 'T' ? '0' : code[0];
    
    // 2. FORCE UPPERCASE SUIT (Fixes the invisible card bug)
    // The backend sends 'h', but the API needs 'H'
    let suit = code[1].toUpperCase(); 
    
    return `https://www.deckofcardsapi.com/static/img/${rank}${suit}.png`;
};

function App() {
  const [user, setUser] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [buyIn, setBuyIn] = useState(100);
  const [raiseAmount, setRaiseAmount] = useState(20);
  const [walletAmount, setWalletAmount] = useState(0); 
  const [isRegistering, setIsRegistering] = useState(false);

  // AUTH HANDLER
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
    } catch(err) { alert("Server Offline. Check Backend Logs."); }
  };

  // WALLET HANDLER
  const handleWallet = async (type) => {
      const res = await fetch(`https://gumble-backend.onrender.com/api/wallet`, {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({userId: user._id, amount: walletAmount, type})
      });
      const data = await res.json();
      if(res.ok) { setUser(data); setWalletAmount(0); alert("Transaction Successful!"); }
      else alert(data.error);
  };

  useEffect(() => {
    socket.on('gameState', setGameState);
    return () => socket.off('gameState');
  }, []);

  const joinGame = () => socket.emit('joinGame', { userId: user._id, buyIn });
  const leaveGame = () => { socket.emit('leaveGame'); setGameState(null); };

  // --- 1. LOGIN SCREEN ---
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

  // --- 2. LOBBY SCREEN ---
  if (!gameState || !gameState.players.find(p => p.name === user.username)) return (
      <div className="lobby-screen">
          <div className="lobby-box">
              <h1>Welcome, {user.username}</h1>
              <div className="balance-display">Wallet: ${user.balance}</div>
              
              <div className="wallet-box">
                  <input type="number" placeholder="Amount" value={walletAmount} onChange={e=>setWalletAmount(e.target.value)} className="lux-input small" />
                  <div className="btn-row">
                      <button onClick={()=>handleWallet('deposit')} className="green-btn">DEPOSIT</button>
                      <button onClick={()=>handleWallet('withdraw')} className="red-btn">WITHDRAW</button>
                  </div>
              </div>

              <div className="stakes-box">
                  <p>Select Table Buy-in:</p>
                  <div className="btn-row">
                      <button onClick={()=>setBuyIn(50)} className={buyIn===50?"active":""}>$50</button>
                      <button onClick={()=>setBuyIn(100)} className={buyIn===100?"active":""}>$100</button>
                  </div>
                  <button className="gold-btn big" onClick={joinGame}>SIT AT TABLE</button>
              </div>
          </div>
      </div>
  );

  // --- 3. GAME TABLE ---
  const mySeat = gameState.players.find(p => p.name === user.username);
  const isMyTurn = gameState.players[gameState.turnIndex]?.id === socket.id;

  return (
    <div className="game-screen">
        <div className="header-bar">
            <button className="leave-btn" onClick={leaveGame}>LEAVE & CASH OUT</button>
        </div>

        <div className="poker-table">
            <div className="table-center">
                <div className="pot-pill">POT: ${gameState.pot}</div>
                
                {/* COMMUNITY CARDS (THE FLOP) */}
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
                         {isTurn && <div className="timer-bar" style={{width