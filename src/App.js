import React, { useState, useEffect } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google'; 
import './App.css';

const API_URL = "https://gumble-backend.onrender.com/api";
const CLIENT_ID = "67123336647-b00rcsb6ni8s8unhi3qqg0bk6l2es62l.apps.googleusercontent.com"; 

const getCardImg = (code) => {
    if(code === 'BACK') return "https://www.deckofcardsapi.com/static/img/back.png";
    return `https://www.deckofcardsapi.com/static/img/${code}.png`;
};

function App() {
  const [user, setUser] = useState(null);
  const [activeGame, setActiveGame] = useState('menu');
  const [bet, setBet] = useState(10);
  const [notification, setNotification] = useState(null); // { msg: "YOU WON $50!", type: "win" }

  // States
  const [bjState, setBjState] = useState(null);
  const [dragonState, setDragonState] = useState({ row: 0, status: 'idle' });
  const [minesState, setMinesState] = useState({ grid: Array(25).fill(null), status: 'idle' });
  
  // Config
  const [dragonDiff, setDragonDiff] = useState('easy');
  const [minesCount, setMinesCount] = useState(3);

  const showNotif = (msg, type) => {
      setNotification({ msg, type });
      setTimeout(() => setNotification(null), 3000);
  };

  const refreshUser = async () => { if(user) { const res = await fetch(`${API_URL}/user/${user._id}`); setUser(await res.json()); }};
  const handleLogin = async (c) => { 
      const res = await fetch(`${API_URL}/auth/google`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({token:c.credential}) });
      if(res.ok) setUser(await res.json());
  };

  // --- BLACKJACK ---
  const dealBj = async () => {
      const res = await fetch(`${API_URL}/blackjack/deal`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userId:user._id, bet}) });
      setBjState(await res.json()); refreshUser();
  };
  const actBj = async (act) => {
      const res = await fetch(`${API_URL}/blackjack/action`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userId:user._id, action: act}) });
      const data = await res.json();
      setBjState(data); refreshUser();
      if(data.status === 'won') showNotif(`YOU WON $${(data.bet*2).toFixed(2)}`, 'win');
      if(data.status === 'bust') showNotif("BUST!", 'lose');
      if(data.status === 'lost') showNotif("DEALER WINS", 'lose');
      if(data.status === 'push') showNotif("PUSH - MONEY BACK", 'neutral');
  };

  // --- DRAGON ---
  const startDragon = async () => {
      const res = await fetch(`${API_URL}/dragon/start`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userId:user._id, bet, difficulty: dragonDiff}) });
      setDragonState(await res.json()); refreshUser();
  };
  const stepDragon = async (c) => {
      const res = await fetch(`${API_URL}/dragon/step`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userId:user._id, choice: c}) });
      const data = await res.json();
      setDragonState({ ...dragonState, ...data });
      if(data.status === 'dead') showNotif("YOU FELL!", 'lose');
  };
  const cashDragon = async () => {
      const res = await fetch(`${API_URL}/dragon/cashout`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userId:user._id}) });
      const data = await res.json();
      setDragonState({ ...dragonState, status: 'won' }); refreshUser();
      showNotif(`CASHOUT $${data.win.toFixed(2)}`, 'win');
  };

  // --- MINES ---
  const startMines = async () => {
      const res = await fetch(`${API_URL}/mines/start`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userId:user._id, bet, mines: minesCount}) });
      setMinesState({ ...await res.json(), grid: Array(25).fill(null) }); refreshUser();
  };
  const clickMine = async (i) => {
      if(minesState.status !== 'playing' || minesState.grid[i]) return;
      const res = await fetch(`${API_URL}/mines/click`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userId:user._id, tile: i}) });
      const data = await res.json();
      const newGrid = [...minesState.grid];
      if(data.status === 'boom') {
          data.grid.forEach((type, idx) => newGrid[idx] = type === 'bomb' ? '💣' : '💎');
          setMinesState({ ...data, grid: newGrid });
          showNotif("BOOM!", 'lose');
      } else {
          newGrid[i] = '💎';
          setMinesState({ ...data, grid: newGrid });
      }
  };
  const cashMines = async () => {
      const res = await fetch(`${API_URL}/mines/cashout`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userId:user._id}) });
      const data = await res.json();
      setMinesState({ ...minesState, status: 'won' }); refreshUser();
      showNotif(`CASHOUT $${data.win.toFixed(2)}`, 'win');
  };


  if(!user) return (
      <div className="login-screen">
          <div className="login-box">
             <h1 className="logo-lg">GUMBLE<span className="gold">VIP</span></h1>
             <GoogleOAuthProvider clientId={CLIENT_ID}><GoogleLogin onSuccess={handleLogin} theme="filled_black" shape="pill" /></GoogleOAuthProvider>
          </div>
      </div>
  );

  return (
    <div className="app-layout">
        {notification && <div className={`notif-overlay ${notification.type}`}>{notification.msg}</div>}
        
        <div className="sidebar">
            <div className="logo">GUMBLE</div>
            <div className="nav-group">
                <div className={`nav-item ${activeGame==='bj'?'active':''}`} onClick={()=>setActiveGame('bj')}>♠️ Blackjack</div>
                <div className={`nav-item ${activeGame==='dragon'?'active':''}`} onClick={()=>setActiveGame('dragon')}>🐉 Dragon Tower</div>
                <div className={`nav-item ${activeGame==='mines'?'active':''}`} onClick={()=>setActiveGame('mines')}>💣 Mines</div>
            </div>
            <div className="user-panel">
                <div className="label">BALANCE</div>
                <div className="bal">${user.balance.toFixed(2)}</div>
            </div>
        </div>

        <div className="main-stage">
            {activeGame === 'menu' && (
                <div className="menu-grid">
                    <div className="game-card" onClick={()=>setActiveGame('bj')}>
                        <div className="icon">♠️</div>
                        <h2>Blackjack</h2>
                    </div>
                    <div className="game-card" onClick={()=>setActiveGame('dragon')}>
                        <div className="icon">🐉</div>
                        <h2>Dragon Tower</h2>
                    </div>
                    <div className="game-card" onClick={()=>setActiveGame('mines')}>
                        <div className="icon">💣</div>
                        <h2>Mines</h2>
                    </div>
                </div>
            )}

            {activeGame === 'bj' && (
                <div className="game-wrapper">
                    <div className="game-header">
                        <h2>BLACKJACK</h2>
                        <div className="payout-info">Pays 3:2</div>
                    </div>
                    <div className="bj-board">
                        {bjState?.status ? (
                            <>
                                <div className="dealer-section">
                                    <div className="hand-label">DEALER</div>
                                    <div className="cards-row">
                                        {bjState.dHand.map((c,i) => <img key={i} src={getCardImg(c.code)} className="real-card" />)}
                                    </div>
                                </div>
                                <div className="player-section">
                                    <div className="hand-label">YOU</div>
                                    <div className="cards-row">
                                        {bjState.pHand.map((c,i) => <img key={i} src={getCardImg(c.code)} className="real-card" />)}
                                    </div>
                                </div>
                            </>
                        ) : <div className="empty-state">PLACE BET TO START</div>}
                    </div>
                    <div className="controls-bar">
                        <div className="input-group">
                            <label>BET AMOUNT</label>
                            <input type="number" value={bet} onChange={e=>setBet(Number(e.target.value))} />
                        </div>
                        {bjState?.status === 'playing' ? (
                            <div className="actions-group">
                                <button className="act-btn hit" onClick={()=>actBj('hit')}>HIT</button>
                                <button className="act-btn stand" onClick={()=>actBj('stand')}>STAND</button>
                                {bjState.canDouble && <button className="act-btn double" onClick={()=>actBj('double')}>DOUBLE</button>}
                            </div>
                        ) : (
                            <button className="act-btn play" onClick={dealBj}>DEAL</button>
                        )}
                    </div>
                </div>
            )}

            {activeGame === 'dragon' && (
                <div className="game-wrapper">
                     <div className="game-header">
                        <h2>DRAGON TOWER</h2>
                        <div className="payout-info">Climb for Multipliers</div>
                    </div>
                    <div className="dragon-board">
                        {[...Array(9)].map((_, i) => {
                            const rIndex = 8 - i; // Reverse render (0 at bottom)
                            const isActive = dragonState.status === 'playing' && dragonState.row === rIndex;
                            const isPast = dragonState.row > rIndex;
                            return (
                                <div key={i} className={`tower-row ${isActive ? 'active-row' : ''} ${isPast ? 'cleared-row' : ''}`}>
                                    <div className="mult-label">x{isActive ? (dragonState.multiplier || 1).toFixed(2) : ''}</div>
                                    <button onClick={()=>stepDragon(0)} disabled={!isActive} className="block-btn"></button>
                                    <button onClick={()=>stepDragon(1)} disabled={!isActive} className="block-btn"></button>
                                    <button onClick={()=>stepDragon(2)} disabled={!isActive} className="block-btn"></button>
                                </div>
                            )
                        })}
                    </div>
                    <div className="controls-bar">
                        <div className="input-group"><label>BET</label><input type="number" value={bet} onChange={e=>setBet(Number(e.target.value))} /></div>
                        <div className="input-group"><label>RISK</label><select value={dragonDiff} onChange={e=>setDragonDiff(e.target.value)}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></div>
                        {dragonState.status === 'playing' ? (
                             <button className="act-btn cashout" onClick={cashDragon}>CASHOUT ${(bet * dragonState.multiplier).toFixed(2)}</button>
                        ) : (
                             <button className="act-btn play" onClick={startDragon}>PLAY</button>
                        )}
                    </div>
                </div>
            )}

             {activeGame === 'mines' && (
                <div className="game-wrapper">
                    <div className="game-header"><h2>MINES</h2></div>
                    <div className="mines-grid">
                        {minesState.grid.map((val, i) => (
                            <button key={i} className={`tile ${val ? 'revealed' : ''} ${val==='💣'?'boom':''} ${val==='💎'?'gem':''}`} 
                                onClick={()=>clickMine(i)} disabled={minesState.status !== 'playing' || val}>
                                {val}
                            </button>
                        ))}
                    </div>
                    <div className="controls-bar">
                        <div className="input-group"><label>BET</label><input type="number" value={bet} onChange={e=>setBet(Number(e.target.value))} /></div>
                        <div className="input-group"><label>MINES</label><select value={minesCount} onChange={e=>setMinesCount(Number(e.target.value))}><option value="3">3</option><option value="5">5</option></select></div>
                        {minesState.status === 'playing' ? (
                            <button className="act-btn cashout" onClick={cashMines}>CASHOUT ${(bet * minesState.multiplier).toFixed(2)}</button>
                        ) : (
                            <button className="act-btn play" onClick={startMines}>PLAY</button>
                        )}
                    </div>
                </div>
            )}
        </div>
    </div>
  );
}
export default App;