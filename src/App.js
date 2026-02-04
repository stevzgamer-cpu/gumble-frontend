import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { io } from "socket.io-client";
import axios from 'axios';

const socket = io('http://localhost:5000');
const API = 'http://localhost:5000/api';

// --- SUB-COMPONENTS ---

// 1. MINES GAME
const Mines = ({ user, onBalanceUpdate, setNotification }) => {
  const [bet, setBet] = useState(10);
  const [minesCount, setMinesCount] = useState(3);
  const [gameActive, setGameActive] = useState(false);
  const [grid, setGrid] = useState([]); // True internal grid (revealed on loss)
  const [revealed, setRevealed] = useState(Array(25).fill(false)); // UI State
  const [multiplier, setMultiplier] = useState(1.0);
  const [currentWin, setCurrentWin] = useState(0);

  const startGame = async () => {
    try {
      const res = await axios.post(`${API}/mines/play`, { userId: user._id, bet, minesCount });
      setGrid(res.data.grid);
      setGameActive(true);
      setRevealed(Array(25).fill(false));
      setMultiplier(1.0);
      setCurrentWin(bet);
    } catch (err) { alert("Insufficient Funds"); }
  };

  const handleTileClick = async (index) => {
    if (!gameActive || revealed[index]) return;
    
    const newRevealed = [...revealed];
    newRevealed[index] = true;
    setRevealed(newRevealed);

    if (grid[index] === 1) {
      // BOOM
      setGameActive(false);
      setNotification({ type: 'LOSS', msg: 'MINED DETONATED' });
    } else {
      // GEM
      const nextMult = multiplier * 1.15; // Simplified math
      setMultiplier(nextMult);
      setCurrentWin(bet * nextMult);
    }
  };

  const cashout = async () => {
    await axios.post(`${API}/mines/cashout`, { userId: user._id, winAmount: currentWin });
    setGameActive(false);
    setNotification({ type: 'WIN', msg: `$${currentWin.toFixed(2)}` });
  };

  return (
    <div className="game-container">
      <div className="control-panel">
        <div className="input-group">
          <label>BET AMOUNT</label>
          <input type="number" value={bet} onChange={e => setBet(Number(e.target.value))} />
        </div>
        <div className="input-group">
          <label>MINES (1-24)</label>
          <input type="number" value={minesCount} onChange={e => setMinesCount(Number(e.target.value))} />
        </div>
        {!gameActive ? (
          <button className="gold-btn" onClick={startGame}>PLAY MINES</button>
        ) : (
          <button className="gold-btn glow" onClick={cashout}>CASHOUT ${(currentWin).toFixed(2)}</button>
        )}
      </div>
      <div className="mines-grid">
        {Array(25).fill(0).map((_, i) => (
          <div 
            key={i} 
            className={`mine-tile ${revealed[i] ? (grid[i] === 1 ? 'bomb' : 'gem') : ''}`}
            onClick={() => handleTileClick(i)}
          >
            {revealed[i] && (grid[i] === 1 ? '💣' : '💎')}
          </div>
        ))}
      </div>
    </div>
  );
};

// 2. BLACKJACK GAME
const Blackjack = ({ user, setNotification }) => {
  const [playerHand, setPlayerHand] = useState([]);
  const [dealerHand, setDealerHand] = useState([]);
  const [bet, setBet] = useState(20);
  const [status, setStatus] = useState('idle'); // idle, playing, finished

  const deal = async () => {
    const res = await axios.post(`${API}/blackjack/deal`, { userId: user._id, bet });
    setPlayerHand(res.data.playerHand);
    setDealerHand(res.data.dealerHand);
    setStatus('playing');
  };

  const calculateScore = (hand) => {
    let score = 0;
    let aces = 0;
    hand.forEach(c => {
      score += c.value;
      if (c.value === 11) aces++;
    });
    while (score > 21 && aces > 0) { score -= 10; aces--; }
    return score;
  };

  const drawCard = () => {
     // Mock drawing a card for demo physics (Server should handle this)
    const suits = ['H', 'D', 'C', 'S'];
    const r = ['2', '3', '4', '5', '6', '7', '8', '9', '0', 'J', 'Q', 'K', 'A'][Math.floor(Math.random()*13)];
    const val = r === 'A' ? 11 : (['J','Q','K','0'].includes(r) ? 10 : parseInt(r));
    return { code: r, value: val, image: `https://deckofcardsapi.com/static/img/${r}H.png` };
  };

  const hit = () => {
    const newCard = drawCard();
    const newHand = [...playerHand, newCard];
    setPlayerHand(newHand);
    if (calculateScore(newHand) > 21) endGame('BUST', newHand, dealerHand);
  };

  const stand = () => {
    let dHand = [...dealerHand];
    while (calculateScore(dHand) < 17) {
      dHand.push(drawCard());
    }
    setDealerHand(dHand);
    
    const pScore = calculateScore(playerHand);
    const dScore = calculateScore(dHand);
    
    if (dScore > 21 || pScore > dScore) endGame('WIN', playerHand, dHand);
    else if (pScore === dScore) endGame('PUSH', playerHand, dHand);
    else endGame('LOSE', playerHand, dHand);
  };

  const endGame = async (result, pHand, dHand) => {
    setStatus('finished');
    if (result === 'WIN') {
      setNotification({ type: 'WIN', msg: 'BLACKJACK WIN' });
      await axios.post(`${API}/blackjack/payout`, { userId: user._id, multiplier: 2, bet });
    } else if (result === 'PUSH') {
      await axios.post(`${API}/blackjack/payout`, { userId: user._id, multiplier: 1, bet });
    }
  };

  return (
    <div className="game-container">
       <div className="bj-table">
          <div className="dealer-area">
            <h3>DEALER ({status === 'playing' ? '?' : calculateScore(dealerHand)})</h3>
            <div className="cards-row">
              {dealerHand.map((c, i) => (
                <img key={i} src={(i === 1 && status === 'playing') ? 'https://deckofcardsapi.com/static/img/back.png' : c.image} className="card" alt="card" />
              ))}
            </div>
          </div>
          
          <div className="player-area">
            <h3>YOU ({calculateScore(playerHand)})</h3>
            <div className="cards-row">
              {playerHand.map((c, i) => <img key={i} src={c.image} className="card" alt="card" />)}
            </div>
          </div>
       </div>

       <div className="control-panel">
         {status === 'idle' || status === 'finished' ? (
           <button className="gold-btn" onClick={deal}>DEAL HAND</button>
         ) : (
           <>
             <button className="gold-btn" onClick={hit}>HIT</button>
             <button className="gold-btn" onClick={stand}>STAND</button>
             <button className="gold-btn outline" onClick={hit}>DOUBLE</button>
           </>
         )}
       </div>
    </div>
  );
}

// --- MAIN APP ---
function App() {
  const [user, setUser] = useState(null);
  const [activeGame, setActiveGame] = useState('MINES');
  const [notification, setNotification] = useState(null);

  // Auth (Simplified for Auto-Login if local storage exists, else Google Logic)
  const handleGoogleLogin = (response) => {
    axios.post(`${API}/auth/google`, { token: response.credential })
      .then(res => setUser(res.data));
  };

  useEffect(() => {
    /* global google */
    if (window.google) {
      google.accounts.id.initialize({
        client_id: "67123336647-b00rcsb6ni8s8unhi3qqg0bk6l2es62l.apps.googleusercontent.com",
        callback: handleGoogleLogin
      });
      google.accounts.id.renderButton(
        document.getElementById("googleBtn"),
        { theme: "outline", size: "large" }
      );
    }
    
    socket.on('balanceUpdate', (data) => {
      if (user && data.userId === user._id) setUser(prev => ({...prev, balance: data.balance}));
    });
  }, [user]);

  // Clear notification after 3s
  useEffect(() => {
    if(notification) setTimeout(() => setNotification(null), 3000);
  }, [notification]);

  return (
    <div className="app-layout">
      {/* SIDEBAR */}
      <nav className="sidebar">
        <h1 className="brand">GUMBLE<span className="gold">VIP</span></h1>
        <div className="menu">
          {['BLACKJACK', 'MINES', 'DRAGON TOWER', 'KENO'].map(game => (
            <button 
              key={game} 
              className={`menu-item ${activeGame === game ? 'active' : ''}`}
              onClick={() => setActiveGame(game)}
            >
              {game}
            </button>
          ))}
        </div>
        {user && (
          <div className="wallet-panel">
            <p className="label">BALANCE</p>
            <p className="amount">${user.balance.toFixed(2)}</p>
            <button className="deposit-btn">DEPOSIT</button>
          </div>
        )}
      </nav>

      {/* MAIN CONTENT */}
      <main className="main-content">
        {!user ? (
          <div className="login-overlay">
             <h1>ENTER THE <span className="gold">VIP LOUNGE</span></h1>
             <div id="googleBtn"></div>
          </div>
        ) : (
          <>
            <header className="top-bar">
               <h2>{activeGame}</h2>
               <div className="user-profile">{user.name}</div>
            </header>
            
            <div className="game-stage">
               {activeGame === 'MINES' && <Mines user={user} setNotification={setNotification} />}
               {activeGame === 'BLACKJACK' && <Blackjack user={user} setNotification={setNotification} />}
               {activeGame === 'DRAGON TOWER' && <div className="placeholder">DRAGON TOWER ENGINE LOADING...</div>}
               {activeGame === 'KENO' && <div className="placeholder">KENO ENGINE LOADING...</div>}
            </div>
          </>
        )}
      </main>
      
      {/* LUXURY NOTIFICATION */}
      {notification && (
        <div className="win-modal">
          <div className="win-content">
            <h1>{notification.type}</h1>
            <p>{notification.msg}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;