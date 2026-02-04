import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google'; 
import './App.css';

const socket = io("https://gumble-backend.onrender.com");
const CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID_HERE"; // PASTE IT HERE TOO

const getCardSrc = (code) => {
    if (!code || code === 'XX' || code.length < 2) return "https://www.deckofcardsapi.com/static/img/back.png";
    let rank = code[0] === 'T' ? '0' : code[0];
    let suit = code[1].toUpperCase();
    return `https://www.deckofcardsapi.com/static/img/${rank}${suit}.png`;
};

function App() {
  const [user, setUser] = useState(null);
  const [tables, setTables] = useState([]);
  const [currentTable, setCurrentTable] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [timer, setTimer] = useState(30);
  const [buyIn, setBuyIn] = useState(100);
  const [raiseAmount, setRaiseAmount] = useState(0);
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

  const handleGoogleSuccess = async (credentialResponse) => {
      try {
          const res = await fetch(`https://gumble-backend.onrender.com/api/google-login`, {
              method: 'POST', headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ token: credentialResponse.credential })
          });
          const data = await res.json();
          if (res.ok) setUser(data);
          else alert("Google Login Failed - Check Console");
      } catch (err) { alert("Server Error"); }
  };

  useEffect(() => {
    socket.on('tableList', setTables);
    socket.on('gameState', (data) => {
        setGameState(data);
        if(data) {
            setTimer(data.timer);
            setRaiseAmount(data.highestBet + (data.bigBlind || 20));
        }
    });
    socket.on('timerUpdate', (t) => setTimer(t));
    const interval = setInterval(() => { if(!currentTable) socket.emit('getTables'); }, 5000);
    socket.emit('getTables');
    return () => { socket.off('gameState'); clearInterval(interval); };
  }, [currentTable]);

  const joinTable = (tableId) => {
      socket.emit('joinTable', { tableId, userId: user._id, buyIn });
      setCurrentTable(tableId);
  };

  const leaveTable = () => {
      socket.emit('leaveTable', { tableId: currentTable });
      setCurrentTable(null);
      setGameState(null);
      socket.emit('getTables');
  };

  const sendAction = (type, amount = 0) => {
      socket.emit('action', { tableId: currentTable, type, amount });
  };

  if (!user) return (
      <div className="login-screen">
          <div className="login-box">
              <h1 className="logo">GUMBLE<span className="gold">STAKE</span></h1>
              <div className="google-wrapper">
                  <GoogleOAuthProvider clientId={CLIENT_ID}>
                      <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => console.log('Login Failed')} theme="filled_black" shape="pill" />
                  </GoogleOAuthProvider>
              </div>
              <div className="divider">OR</div>
              <form onSubmit={handleAuth}>
                  <input className="lux-input" name="username" placeholder="Username" />
                  <input className="lux-input" name="password" type="password" placeholder="Password" />
                  <button className="gold-btn">{isRegistering ? "REGISTER" : "LOGIN"}</button>
              </form>
              <p className="toggle" onClick={()=>setIsRegistering(!isRegistering)}>{isRegistering ? "Back to Login" : "Create Account"}</p>
          </div>
      </div>
  );

  if (!currentTable) return (
      <div className="lobby-screen">
          <div className="lobby-header"><h1>LOBBY</h1><div className="balance-badge">Wallet: ${user.balance}</div></div>
          <div className="table-grid">
              {tables.map(t => (
                  <div key={t.id} className="table-card">
                      <h3>{t.name}</h3>
                      <p>{t.players} Players</p>
                      <button className="gold-btn" onClick={() => joinTable(t.id)}>JOIN TABLE</button>
                  </div>
              ))}
          </div>
      </div>
  );

  if (!gameState) return <div className="loading">Loading Table...</div>;
  const myPlayer = gameState.players.find(p => p.name === user.username);
  const isMyTurn = gameState.players[gameState.turnIndex]?.id === socket.id;
  const currentBet = myPlayer?.currentBet || 0;
  const toCall = gameState.highestBet - currentBet;

  return (
    <div className="game-screen">
        <button className="leave-btn" onClick={leaveTable}>EXIT</button>
        <div className="poker-table">
            <div className="table-center">
                <div className="pot-pill">POT: ${gameState.pot}</div>
                <div className="community-cards">
                    {gameState.communityCards.map((c, i) => <img key={i} src={getCardSrc(c)} className="real-card" alt="card" />)}
                </div>
                {gameState.phase === 'showdown' && <div className="winner-msg">WINNER: {gameState.winners.join(", ")}</div>}
            </div>
            {gameState.players.map((p, i) => {
                const isTurn = gameState.players[gameState.turnIndex]?.id === p.id;
                const timerWidth = isTurn ? `${(timer / 30) * 100}%` : '0%';
                return (
                    <div key={i} className={`seat seat-${i} ${isTurn ? 'active-turn' : ''} ${p.folded ? 'folded' : ''}`}>
                         {isTurn && <div className="timer-bar" style={{width: timerWidth}}></div>}
                         <div className="avatar">{p.name[0]}</div>
                         <div className="p-info"><div>{p.name}</div><div className="p-bal">${p.balance}</div></div>
                         <div className="hand">{p.hand.map((c, j) => <img key={j} src={getCardSrc((p.name===user.username || gameState.phase==='showdown') ? c : 'XX')} className="real-card small" alt="card" />)}</div>
                         {p.currentBet > 0 && <div className="bet-bubble">${p.currentBet}</div>}
                    </div>
                );
            })}
        </div>
        <div className={`controls-dock ${!isMyTurn ? 'disabled' : ''}`}>
            <div className="slider-box">
                <input type="range" min={gameState.highestBet + 10} max={myPlayer?.balance} value={raiseAmount} onChange={(e)=>setRaiseAmount(Number(e.target.value))} />
                <span>Raise To: ${raiseAmount}</span>
            </div>
            <div className="action-btns">
                <button className="act-btn fold" onClick={()=>sendAction('fold')}>FOLD</button>
                <button className="act-btn check" onClick={()=>sendAction('call')}>{toCall === 0 ? "CHECK" : `CALL $${toCall}`}</button>
                <button className="act-btn raise" onClick={()=>sendAction('raise', raiseAmount)}>RAISE</button>
            </div>
        </div>
    </div>
  );
}

export default App;