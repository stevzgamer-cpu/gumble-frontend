import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';

const socket = io("https://gumble-backend.onrender.com");

const getCardSrc = (code) => {
    if (!code || code === 'XX' || code.length < 2) {
        return "https://www.deckofcardsapi.com/static/img/back.png";
    }
    let rank = code[0] === 'T' ? '0' : code[0];
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

  const handleWallet = async (type) => {
      const res = await fetch(`https://gumble-backend.onrender.com/api/wallet`, {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({userId: user._id, amount: walletAmount, type})
      });
      const data = await res.json();
      if(res.ok) { setUser(data); setWalletAmount(0); alert("Success!"); }
      else alert(data.error);
  };

  useEffect(() => {
    socket.on('gameState', setGameState);
    return () => socket.off('gameState');
  }, []);

  const joinGame = () => socket.emit('joinGame', { userId: user._id, buyIn });
  const leaveGame = () => { socket.emit('leaveGame'); setGameState(null); };

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
              </