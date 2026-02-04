import React, { useState, useEffect } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google'; 
import './App.css';

const API_URL = "https://gumble-backend.onrender.com/api";
const CLIENT_ID = "67123336647-b00rcsb6ni8s8unhi3qqg0bk6l2es62l.apps.googleusercontent.com"; 

function App() {
  const [user, setUser] = useState(null);
  const [activeGame, setActiveGame] = useState('mines'); // mines, bj, dragon
  const [bet, setBet] = useState(10);
  
  // Game States
  const [minesState, setMinesState] = useState({ grid: Array(25).fill(null), status: 'idle', multiplier: 1.0 });
  const [bjState, setBjState] = useState(null);
  const [dragonState, setDragonState] = useState({ row: 0, status: 'idle', multiplier: 1.0 });
  
  // Configs
  const [minesCount, setMinesCount] = useState(3);
  const [dragonDiff, setDragonDiff] = useState('easy');

  const refreshUser = async () => { if(user) { const res = await fetch(`${API_URL}/user/${user._id}`); setUser(await res.json()); }};
  const handleLogin = async (c) => { 
      const res = await fetch(`${API_URL}/auth/google`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({token:c.credential}) });
      if(res.ok) setUser(await res.json());
  };

  // --- MINES LOGIC ---
  const startMines = async () => {
      const res = await fetch(`${API_URL}/mines/start`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userId:user._id, bet, mines: minesCount}) });
      setMinesState({ ...await res.json(), grid: Array(25).fill(null) });
      refreshUser();
  };
  const clickMine = async (i) => {
      if(minesState.status !== 'playing' || minesState.grid[i]) return;
      const res = await fetch(`${API_URL}/mines/click`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userId:user._id, tile: i}) });
      const data = await res.json();
      const newGrid = [...minesState.grid];
      if(data.status === 'boom') {
          data.grid.forEach((type, idx) => newGrid[idx] = type === 'bomb' ? '💣' : '💎');
          setMinesState({ ...data, grid: newGrid });
      } else {
          newGrid[i] = '💎';
          setMinesState({ ...data, grid: newGrid });
      }
  };
  const cashoutMines = async () => {
      const res = await fetch(`${API_URL}/mines/cashout`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userId:user._id}) });
      const data = await res.json();
      setMinesState({ ...minesState, status: 'won', winAmount: data.win });
      refreshUser();
  };

  // --- BLACKJACK LOGIC ---
  const dealBj = async () => {
      const res = await fetch(`${API_URL}/blackjack/deal`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userId:user._id, bet}) });
      setBjState(await res.json());
      refreshUser();
  };
  const actionBj = async (act) => {
      const res = await fetch(`${API_URL}/blackjack/action`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userId:user._id, action: act}) });
      setBjState(await res.json());
      refreshUser();
  };

  // --- DRAGON LOGIC ---
  const startDragon = async () => {
      const res = await fetch(`${API_URL}/dragon/start`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userId:user._id, bet, difficulty: dragonDiff}) });
      setDragonState(await res.json());
      refreshUser();
  };
  const stepDragon = async (choice) => {
      const res = await fetch(`${API_URL}/dragon/step`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userId:user._id, choice}) });
      const data = await res.json();
      setDragonState({ ...dragonState, ...data });
  };
  const cashoutDragon = async () => {
      const res = await fetch(`${API_URL}/dragon/cashout`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userId:user._id}) });
      const data = await res.json();
      setDragonState({ ...dragonState, status: 'won', winAmount: data.win });
      refreshUser();
  };

  if(!user) return (
      <div className="login-screen">
          <div className="login-box">
             <h1>GUMBLE<span className="gold">STAKE</span></h1>
             <GoogleOAuthProvider clientId={CLIENT_ID}><GoogleLogin onSuccess={handleLogin} theme="filled_black" shape="pill" /></GoogleOAuthProvider>
          </div>
      </div>
  );

  return (
    <div className="app-layout">
        <div className="sidebar">
            <div className="logo">GUMBLE</div>
            <div className={`nav-item ${activeGame==='mines'?'active':''}`} onClick={()=>setActiveGame('mines')}>💣 Mines</div>
            <div className={`nav-item ${activeGame==='bj'?'active':''}`} onClick={()=>setActiveGame('bj')}>♠️ Blackjack</div>
            <div className={`nav-item ${activeGame==='dragon'?'active':''}`} onClick={()=>setActiveGame('dragon')}>🐉 Dragon</div>
            <div className="user-panel">
                <div className="uname">{user.username}</div>
                <div className="bal">${user.balance.toFixed(2)}</div>
            </div>
        </div>

        <div className="main-stage">
            {/* MINES GAME */}
            {activeGame === 'mines' && (
                <div className="game-wrapper">
                    <div className="game-board">
                        <div className="mines-grid">
                            {minesState.grid.map((val, i) => (
                                <button key={i} 
                                    className={`tile ${val ? 'revealed' : ''} ${val==='💣'?'boom':''} ${val==='💎'?'gem':''}`} 
                                    onClick={()=>clickMine(i)}
                                    disabled={minesState.status !== 'playing' || val}
                                >
                                    {val}
                                </button>
                            ))}
                        </div>
                        {minesState.status === 'won' && <div className="win-overlay">CASHED OUT: ${minesState.winAmount?.toFixed(2)}</div>}
                        {minesState.status === 'boom' && <div className="lose-overlay">BUSTED!</div>}
                    </div>
                    <div className="controls">
                        <div className="control-group">
                            <label>Bet Amount</label>
                            <input type="number" value={bet} onChange={e=>setBet(Number(e.target.value))} />
                        </div>
                        <div className="control-group">
                            <label>Mines</label>
                            <select value={minesCount} onChange={e=>setMinesCount(Number(e.target.value))}>
                                <option value="1">1</option><option value="3">3</option><option value="5">5</option><option value="10">10</option>
                            </select>
                        </div>
                        {minesState.status === 'playing' ? (
                            <button className="action-btn cashout" onClick={cashoutMines}>
                                CASHOUT ${(bet * minesState.multiplier).toFixed(2)} ({minesState.multiplier.toFixed(2)}x)
                            </button>
                        ) : (
                            <button className="action-btn play" onClick={startMines}>PLAY</button>
                        )}
                    </div>
                </div>
            )}

            {/* BLACKJACK GAME */}
            {activeGame === 'bj' && (
                <div className="game-wrapper">
                    <div className="bj-board">
                        {bjState?.status === 'playing' || bjState?.status === 'won' || bjState?.status === 'lost' ? (
                            <>
                                <div className="hand dealer">
                                    <h3>Dealer ({bjState.status === 'playing' ? '?' : 'Final'})</h3>
                                    <div className="cards">{bjState.dHand.map((c,i) => <div key={i} className="card">{c.rank}{c.suit}</div>)}</div>
                                </div>
                                <div className="hand player">
                                    <h3>You</h3>
                                    <div className="cards">{bjState.pHand.map((c,i) => <div key={i} className="card">{c.rank}{c.suit}</div>)}</div>
                                </div>
                                {bjState.status !== 'playing' && <div className="bj-result">{bjState.status.toUpperCase()}</div>}
                            </>
                        ) : <div className="placeholder">Place your bet to deal cards</div>}
                    </div>
                    <div className="controls">
                        <div className="control-group"><label>Bet</label><input type="number" value={bet} onChange={e=>setBet(Number(e.target.value))} /></div>
                        {bjState?.status === 'playing' ? (
                            <div className="bj-actions">
                                <button className="action-btn hit" onClick={()=>actionBj('hit')}>HIT</button>
                                <button className="action-btn stand" onClick={()=>actionBj('stand')}>STAND</button>
                            </div>
                        ) : (
                            <button className="action-btn play" onClick={dealBj}>DEAL</button>
                        )}
                    </div>
                </div>
            )}

            {/* DRAGON GAME */}
            {activeGame === 'dragon' && (
                <div className="game-wrapper">
                    <div className="dragon-tower">
                         {[...Array(8)].map((_, r) => {
                             const rowIndex = 7 - r; // Visual render top-down, but logic bottom-up
                             const isCurrent = dragonState.row === rowIndex;
                             return (
                                 <div key={r} className={`tower-row ${isCurrent ? 'active' : ''}`}>
                                     <button onClick={()=>stepDragon(0)} disabled={!isCurrent}>🧱</button>
                                     <button onClick={()=>stepDragon(1)} disabled={!isCurrent}>🧱</button>
                                     <button onClick={()=>stepDragon(2)} disabled={!isCurrent}>🧱</button>
                                 </div>
                             )
                         })}
                    </div>
                    <div className="controls">
                         <div className="control-group"><label>Bet</label><input type="number" value={bet} onChange={e=>setBet(Number(e.target.value))} /></div>
                         <div className="control-group"><label>Diff</label><select value={dragonDiff} onChange={e=>setDragonDiff(e.target.value)}><option value="easy">Easy</option><option value="hard">Hard</option></select></div>
                         {dragonState.status === 'playing' ? (
                            <button className="action-btn cashout" onClick={cashoutDragon}>
                                CASHOUT ${(bet * dragonState.multiplier).toFixed(2)}
                            </button>
                        ) : (
                            <button className="action-btn play" onClick={startDragon}>PLAY</button>
                        )}
                         {dragonState.status === 'dead' && <div className="lose-overlay">FELL!</div>}
                         {dragonState.status === 'won' && <div className="win-overlay">CLIMBED!</div>}
                    </div>
                </div>
            )}
        </div>
    </div>
  );
}
export default App;