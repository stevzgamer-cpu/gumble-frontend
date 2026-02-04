import React, { useState, useEffect } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google'; 
import './App.css';

const API_URL = "https://gumble-backend.onrender.com/api";
const CLIENT_ID = "67123336647-b00rcsb6ni8s8unhi3qqg0bk6l2es62l.apps.googleusercontent.com"; 

function App() {
  const [user, setUser] = useState(null);
  const [activeGame, setActiveGame] = useState('menu'); // menu, blackjack, mines, keno, dragon
  const [message, setMessage] = useState("");
  
  // Game States
  const [bet, setBet] = useState(10);
  const [bjState, setBjState] = useState(null);
  const [minesConfig, setMinesConfig] = useState({ count: 3 });
  const [kenoNums, setKenoNums] = useState([]);
  const [lastResult, setLastResult] = useState(null);

  const refreshUser = async () => {
      if(!user) return;
      const res = await fetch(`${API_URL}/user/${user._id}`);
      setUser(await res.json());
  };

  const handleLogin = async (creds) => {
      const res = await fetch(`${API_URL}/auth/google`, {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({token: creds.credential})
      });
      const data = await res.json();
      if(res.ok) setUser(data);
  };

  // --- BLACKJACK FUNCS ---
  const playBj = async (action) => {
      if(action === 'deal') {
          const res = await fetch(`${API_URL}/blackjack/deal`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({userId: user._id, bet}) });
          setBjState(await res.json());
      } else {
          const res = await fetch(`${API_URL}/blackjack/${action}`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({userId: user._id}) });
          setBjState(await res.json());
      }
      refreshUser();
  };

  // --- MINES FUNCS ---
  const playMines = async (tileIdx) => {
      const res = await fetch(`${API_URL}/mines/play`, { 
          method: 'POST', headers: {'Content-Type': 'application/json'}, 
          body: JSON.stringify({userId: user._id, bet, minesCount: minesConfig.count, clickedTile: tileIdx}) 
      });
      const data = await res.json();
      setLastResult(data);
      refreshUser();
      if(data.result === 'bomb') setMessage(`💥 BOOM! You hit a mine.`);
      else setMessage(`💎 GEM! Won $${data.win}`);
  };

  // --- KENO FUNCS ---
  const playKeno = async () => {
      if(kenoNums.length === 0) return alert("Pick numbers!");
      const res = await fetch(`${API_URL}/keno/play`, { 
          method: 'POST', headers: {'Content-Type': 'application/json'}, 
          body: JSON.stringify({userId: user._id, bet, numbers: kenoNums}) 
      });
      const data = await res.json();
      setLastResult(data);
      refreshUser();
  };

  // --- DRAGON TOWER FUNCS ---
  const playDragon = async (diff) => {
      const res = await fetch(`${API_URL}/dragon/play`, { 
          method: 'POST', headers: {'Content-Type': 'application/json'}, 
          body: JSON.stringify({userId: user._id, bet, difficulty: diff}) 
      });
      const data = await res.json();
      setLastResult(data);
      refreshUser();
      setMessage(data.result === 'safe' ? `🐉 CLIMBED! Won $${data.win}` : "💀 FELL!");
  };

  if (!user) return (
      <div className="login-screen">
          <h1 className="logo">GUMBLE<span className="gold">CASINO</span></h1>
          <GoogleOAuthProvider clientId={CLIENT_ID}>
              <GoogleLogin onSuccess={handleLogin} theme="filled_black" shape="pill" />
          </GoogleOAuthProvider>
      </div>
  );

  return (
    <div className="app">
        <div className="header">
            <div className="logo" onClick={()=>setActiveGame('menu')}>GUMBLE</div>
            <div className="bal">Balance: ${user.balance.toFixed(2)}</div>
            <button className="back-btn" onClick={()=>setActiveGame('menu')}>MENU</button>
        </div>

        {/* --- MAIN MENU --- */}
        {activeGame === 'menu' && (
            <div className="menu-grid">
                <div className="card-game" onClick={()=>setActiveGame('blackjack')}>
                    <h2>♠️ BLACKJACK</h2>
                    <p>Beat the Dealer</p>
                </div>
                <div className="card-game" onClick={()=>setActiveGame('mines')}>
                    <h2>💣 MINES</h2>
                    <p>Don't Explode</p>
                </div>
                <div className="card-game" onClick={()=>setActiveGame('keno')}>
                    <h2>🎱 KENO</h2>
                    <p>Lucky Numbers</p>
                </div>
                <div className="card-game" onClick={()=>setActiveGame('dragon')}>
                    <h2>🐉 DRAGON TOWER</h2>
                    <p>Climb & Win</p>
                </div>
            </div>
        )}

        {/* --- BLACKJACK UI --- */}
        {activeGame === 'blackjack' && (
            <div className="game-container">
                <h1>BLACKJACK (Pays 2:1)</h1>
                {!bjState || bjState.status !== 'playing' ? (
                    <div className="bet-controls">
                        <input type="number" value={bet} onChange={e=>setBet(Number(e.target.value))} />
                        <button className="gold-btn" onClick={()=>playBj('deal')}>DEAL (${bet})</button>
                        {bjState && <div className="result-msg">{bjState.status.toUpperCase()}</div>}
                    </div>
                ) : (
                    <div className="bj-table">
                        <div className="hand dealer">
                            <h3>Dealer</h3>
                            {bjState.dealerHand.map((c,i) => <div key={i} className="card">{c.rank}{c.suit}</div>)}
                        </div>
                        <div className="hand player">
                            <h3>You</h3>
                            {bjState.playerHand.map((c,i) => <div key={i} className="card">{c.rank}{c.suit}</div>)}
                        </div>
                        <div className="actions">
                            <button className="act-btn hit" onClick={()=>playBj('hit')}>HIT</button>
                            <button className="act-btn stand" onClick={()=>playBj('stand')}>STAND</button>
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* --- MINES UI --- */}
        {activeGame === 'mines' && (
            <div className="game-container">
                <h1>MINES</h1>
                <div className="bet-controls">
                    Bet: <input type="number" value={bet} onChange={e=>setBet(Number(e.target.value))} />
                    Mines: <select onChange={e=>setMinesConfig({count: Number(e.target.value)})}>
                        <option value="1">1 Mine</option><option value="3">3 Mines</option><option value="5">5 Mines</option>
                    </select>
                </div>
                <h3 style={{color: '#d4af37'}}>{message}</h3>
                <div className="mines-grid">
                    {Array(25).fill(0).map((_, i) => (
                        <div key={i} className="mine-tile" onClick={()=>playMines(i)}>❓</div>
                    ))}
                </div>
            </div>
        )}

        {/* --- KENO UI --- */}
        {activeGame === 'keno' && (
            <div className="game-container">
                <h1>KENO (Pick up to 10)</h1>
                <div className="bet-controls">
                    Bet: <input type="number" value={bet} onChange={e=>setBet(Number(e.target.value))} />
                    <button className="gold-btn" onClick={playKeno}>PLAY</button>
                </div>
                {lastResult && <div className="result-msg">Matched: {lastResult.matches} | Won: ${lastResult.payout}</div>}
                <div className="keno-grid">
                    {Array(40).fill(0).map((_, i) => {
                        const n = i+1;
                        const isSelected = kenoNums.includes(n);
                        const isDrawn = lastResult?.draw.includes(n);
                        return (
                            <div key={n} 
                                 className={`keno-ball ${isSelected ? 'selected' : ''} ${isDrawn ? 'drawn' : ''}`}
                                 onClick={() => {
                                     if(isSelected) setKenoNums(kenoNums.filter(x=>x!==n));
                                     else if(kenoNums.length<10) setKenoNums([...kenoNums, n]);
                                 }}
                            >{n}</div>
                        );
                    })}
                </div>
            </div>
        )}

        {/* --- DRAGON UI --- */}
        {activeGame === 'dragon' && (
            <div className="game-container">
                <h1>DRAGON TOWER</h1>
                <div className="bet-controls">
                    Bet: <input type="number" value={bet} onChange={e=>setBet(Number(e.target.value))} />
                </div>
                <h3 style={{color: message.includes('Win') ? 'green' : 'red'}}>{message}</h3>
                <div className="dragon-actions">
                    <button className="act-btn safe" onClick={()=>playDragon('easy')}>EASY (1.4x)</button>
                    <button className="act-btn risk" onClick={()=>playDragon('hard')}>HARD (2.5x)</button>
                </div>
            </div>
        )}
    </div>
  );
}

export default App;