import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google'; 
import './App.css';

const socket = io("https://gumble-backend.onrender.com");
const CLIENT_ID = "67123336647-b00rcsb6ni8s8unhi3qqg0bk6l2es62l.apps.googleusercontent.com"; 

const getCardSrc = (c) => c === 'XX' ? "https://www.deckofcardsapi.com/static/img/back.png" : `https://www.deckofcardsapi.com/static/img/${c[0] === 'T' ? '0' : c[0]}${c[1].toUpperCase()}.png`;

function App() {
  const [user, setUser] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selTable, setSelTable] = useState(null);
  const [buyIn, setBuyIn] = useState(100);

  useEffect(() => {
    socket.on('gameState', setGameState);
    return () => socket.off('gameState');
  }, []);

  const handleLogin = async (creds) => {
    const res = await fetch("https://gumble-backend.onrender.com/api/google-login", { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({token: creds.credential}) });
    const data = await res.json();
    if(res.ok) setUser(data);
  };

  const join = () => {
    socket.emit('joinTable', { tableId: selTable, userId: user._id, buyIn });
    setShowModal(false);
  };

  if (!user) return (
    <div className="login-screen">
      <div className="login-box">
        <h1 className="logo">GUMBLE<span className="gold">STAKE</span></h1>
        <GoogleOAuthProvider clientId={CLIENT_ID}>
          <GoogleLogin onSuccess={handleLogin} theme="filled_black" shape="pill" />
        </GoogleOAuthProvider>
      </div>
    </div>
  );

  if (!gameState) return (
    <div className="lobby-screen">
      <div className="lobby-header"><h1>LOBBY</h1><div className="balance-badge">${user.balance}</div></div>
      <div className="table-grid">
        <div className="table-card">
            <h3>Casual ($10/$20)</h3>
            <button className="gold-btn" onClick={() => {setSelTable('t1'); setShowModal(true);}}>JOIN</button>
        </div>
        <div className="table-card">
            <h3>Pro ($20/$40)</h3>
            <button className="gold-btn" onClick={() => {setSelTable('t2'); setShowModal(true);}}>JOIN</button>
        </div>
      </div>
      {showModal && <div className="modal-overlay"><div className="modal-box">
        <h3>BUY IN: ${buyIn}</h3>
        <input type="range" min="10" max={user.balance} value={buyIn} onChange={e=>setBuyIn(Number(e.target.value))} />
        <div className="modal-actions">
            <button className="gold-btn" onClick={join}>CONFIRM</button>
            <button className="red-btn" onClick={()=>setShowModal(false)}>CANCEL</button>
        </div>
      </div></div>}
    </div>
  );

  const myTurn = gameState.players[gameState.turnIndex]?.id === socket.id;
  const me = gameState.players.find(p => p.name === user.username);

  return (
    <div className="game-screen">
      <div className="poker-table">
        <div className="table-center">
            <div className="pot-pill">POT: ${gameState.pot}</div>
            <div className="community-cards">
                {gameState.communityCards.map((c, i) => <img key={i} src={getCardSrc(c)} className="real-card" />)}
            </div>
            {gameState.winners.length > 0 && <div className="winner-msg">WINNER: {gameState.winners.join(", ")}</div>}
        </div>
        {gameState.players.map((p, i) => (
          <div key={i} className={`seat seat-${i} ${gameState.turnIndex === i ? 'active-turn' : ''} ${p.folded ? 'folded' : ''}`}>
            <div className="avatar">{p.name[0]}</div>
            <div className="p-info"><div>{p.name}</div><div>${p.balance}</div></div>
            <div className="hand">
              {p.hand.map((c, j) => <img key={j} src={getCardSrc(p.name === user.username || gameState.phase === 'showdown' ? c : 'XX')} className="real-card small" />)}
            </div>
            {p.bet > 0 && <div className="bet-bubble">${p.bet}</div>}
          </div>
        ))}
      </div>
      <div className={`controls-dock ${!myTurn ? 'disabled' : ''}`}>
        <button className="act-btn fold" onClick={() => socket.emit('action', {tableId: selTable, type: 'fold'})}>FOLD</button>
        <button className="act-btn check" onClick={() => socket.emit('action', {tableId: selTable, type: 'call'})}>CALL/CHECK</button>
        <button className="act-btn raise" onClick={() => socket.emit('action', {tableId: selTable, type: 'raise', amount: gameState.highestBet + 20})}>RAISE +$20</button>
      </div>
    </div>
  );
}
export default App;