import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google'; 
import './App.css';

const socket = io("https://gumble-backend.onrender.com");
// --- ⚠️ PASTE YOUR GOOGLE CLIENT ID HERE ---
const CLIENT_ID = "67123336647-b00rcsb6ni8s8unhi3qqg0bk6l2es62l.apps.googleusercontent.com"; 

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
  
  // Controls
  const [buyInAmount, setBuyInAmount] = useState(100);
  const [raiseAmount, setRaiseAmount] = useState(0);

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
        const res = await fetch(`https://gumble-backend.onrender.com/api/login`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username: e.target.username.value, password: e.target.password.value})
        });
        const data = await res.json();
        if (res.ok) setUser(data); else alert(data.error);
    } catch(err) { alert("Server Offline"); }
  };

  const handleGoogleSuccess = async (res) => {
      try {
          const apiRes = await fetch(`https://gumble-backend.onrender.com/api/google-login`, {
              method: 'POST', headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ token: res.credential })
          });
          const data = await apiRes.json();
          if (apiRes.ok) setUser(data);
      } catch (err) { alert("Login Error"); }
  };

  useEffect(() => {
    socket.on('tableList', setTables);
    socket.on('gameState', (data) => {
        setGameState(data);
        if(data) {
            setTimer(data.timer);
            setRaiseAmount(data.highestBet + 20);
        }
    });
    socket.on('timerUpdate', setTimer);
    const i = setInterval(() => { if(!currentTable) socket.emit('getTables'); }, 5000);
    socket.emit('getTables');
    return () => { socket.off('gameState'); clearInterval(i); };
  }, [currentTable]);

  const joinTable = (tableId) => {
      if (buyInAmount < 10 || buyInAmount > user.balance) {
          alert("Invalid Buy-In Amount");
          return;
      }
      socket.emit('joinTable', { tableId, userId: user._id, buyIn: buyInAmount });
      setCurrentTable(tableId);
  };

  const sendAction = (type) => {
      socket.emit('action', { tableId: currentTable, type, amount: raiseAmount });
  };

  if (!user) return (
      <div className="login-screen">
          <div className="login-box">
              <h1 className="logo">GUMBLE<span className="gold">STAKE</span></h1>
              <div className="google-wrapper">
                  <GoogleOAuthProvider clientId={CLIENT_ID}>
                      <GoogleLogin onSuccess={handleGoogleSuccess} theme="filled_black" shape="pill" />
                  </GoogleOAuthProvider>
              </div>
              <form onSubmit={handleAuth}>
                  <input className="lux-input" name="username" placeholder="User" />
                  <input className="lux-input" name="password" type="password" placeholder="Pass" />
                  <button className="gold-btn">LOGIN</button>
              </form>
          </div>
      </div>
  );

  if (!currentTable) return (
      <div className="lobby-screen">
          <div className="lobby-header"><h1>LOBBY</h1><div className="balance-badge">${user.balance}</div></div>
          <div className="table-grid">
              {tables.map(t => (
                  <div key={t.id} className="table-card">
                      <h3>{t.name}</h3>
                      <p>{t.players} Players</p>
                      
                      <div className="buyin-control">
                          <label>Buy In: ${buyInAmount}</label>
                          <input type="range" min="10" max={user.balance} value={buyInAmount} onChange={e=>setBuyInAmount(Number(e.target.value))} />
                      </div>
                      
                      <button className="gold-btn" onClick={() => joinTable(t.id)}>JOIN</button>
                  </div>
              ))}
          </div>
      </div>
  );

  if (!gameState) return <div className="loading">Loading...</div>;
  
  const myPlayer = gameState.players.find(p => p.name === user.username);
  const isMyTurn = gameState.players[gameState.turnIndex]?.id === socket.id;
  const toCall = gameState.highestBet - (myPlayer?.currentBet || 0);

  return (
    <div className="game-screen">
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
                
                // FORCE CARD VISIBILITY: Only hide if NOT me AND NOT showdown
                const showCards = p.name === user.username || gameState.phase === 'showdown';

                return (
                    <div key={i} className={`seat seat-${i} ${isTurn ? 'active-turn' : ''} ${p.folded ? 'folded' : ''}`}>
                         {isTurn && <div className="timer-bar" style={{width: timerWidth}}></div>}
                         <div className="avatar">{p.name[0]}</div>
                         <div className="p-info"><div>{p.name}</div><div className="p-bal">${p.balance}</div></div>
                         <div className="hand">
                             {p.hand.map((c, j) => (
                                <img key={j} src={getCardSrc(showCards ? c : 'XX')} className="real-card small" alt="card" />
                             ))}
                         </div>
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
                <button className="act-btn check" onClick={()=>sendAction(toCall === 0 ? 'check' : 'call')}>
                    {toCall === 0 ? "CHECK" : `CALL $${toCall}`}
                </button>
                <button className="act-btn raise" onClick={()=>sendAction('raise')}>RAISE</button>
            </div>
        </div>
    </div>
  );
}

export default App;