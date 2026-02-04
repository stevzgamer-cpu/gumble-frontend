import React, { useState, useEffect } from 'react';
import './App.css';
import { io } from "socket.io-client";
import axios from 'axios';

// --- NETWORK CONFIGURATION ---
// Automatically switches API based on where the site is running
const IS_LOCAL = window.location.hostname === 'localhost';
const BACKEND_URL = IS_LOCAL 
  ? 'http://localhost:5000' 
  : 'https://gumble-backend.onrender.com'; // <--- VERIFY THIS MATCHES YOUR RENDER BACKEND NAME

const API = `${BACKEND_URL}/api`;
const socket = io(BACKEND_URL);

// --- COMPONENTS ---

const MinesGame = ({ user, setNotification }) => {
    const [bet, setBet] = useState(10);
    const [mines, setMines] = useState(3);
    const [active, setActive] = useState(false);
    const [grid, setGrid] = useState([]); // The hidden server grid
    const [revealed, setRevealed] = useState(Array(25).fill(false));
    const [currentMult, setCurrentMult] = useState(1.0);
    
    const startGame = async () => {
        try {
            const res = await axios.post(`${API}/mines/play`, { userId: user._id, bet, minesCount: mines });
            setGrid(res.data.grid);
            setActive(true);
            setRevealed(Array(25).fill(false));
            setCurrentMult(1.0);
        } catch (e) { alert("Error starting game"); }
    };

    const handleTile = async (idx) => {
        if(!active || revealed[idx]) return;
        
        const newRev = [...revealed];
        newRev[idx] = true;
        setRevealed(newRev);

        if(grid[idx] === 1) {
            // LOSS
            setActive(false);
            setNotification({ type: 'LOSS', msg: 'MINE DETONATED' });
        } else {
            // WIN STEP
            const nextMult = currentMult * 1.15; // Simplified math
            setCurrentMult(nextMult);
        }
    };

    const cashout = async () => {
        const win = bet * currentMult;
        await axios.post(`${API}/mines/cashout`, { userId: user._id, winAmount: win });
        setActive(false);
        setNotification({ type: 'WIN', msg: `+$${win.toFixed(2)}` });
    };

    return (
        <div className="game-wrapper">
            <div className="game-controls">
                <div className="input-box">
                    <label>BET</label>
                    <input type="number" value={bet} onChange={e=>setBet(Number(e.target.value))} />
                </div>
                <div className="input-box">
                    <label>MINES</label>
                    <input type="number" value={mines} onChange={e=>setMines(Number(e.target.value))} />
                </div>
                {!active ? 
                    <button className="action-btn gold" onClick={startGame}>PLAY</button> :
                    <button className="action-btn green" onClick={cashout}>CASHOUT ${(bet*currentMult).toFixed(2)}</button>
                }
            </div>
            <div className="mines-board">
                {Array(25).fill(0).map((_, i) => (
                    <div key={i} 
                         className={`tile ${revealed[i] ? (grid[i]===1 ? 'bomb' : 'gem') : ''}`}
                         onClick={() => handleTile(i)}>
                         {revealed[i] && (grid[i]===1 ? '💣' : '💎')}
                    </div>
                ))}
            </div>
        </div>
    );
};

const BlackjackGame = ({ user, setNotification }) => {
    const [bet, setBet] = useState(20);
    const [pHand, setPHand] = useState([]);
    const [dHand, setDHand] = useState([]);
    const [status, setStatus] = useState('idle');

    const getScore = (hand) => {
        let sc = 0; let ace = 0;
        hand.forEach(c => { sc += c.value; if(c.value===11) ace++; });
        while(sc > 21 && ace > 0) { sc-=10; ace--; }
        return sc;
    };

    const deal = async () => {
        const res = await axios.post(`${API}/blackjack/deal`, { userId: user._id, bet });
        setPHand(res.data.playerHand);
        setDHand(res.data.dealerHand);
        setStatus('playing');
    };

    // Simplified Hit Logic (Frontend simulation for speed, Production should verify on backend)
    const hit = () => {
        const newCard = { code: 'XH', value: Math.floor(Math.random()*10)+1, image: 'https://deckofcardsapi.com/static/img/0H.png' }; 
        // Note: For real production, call API /blackjack/hit
        const newHand = [...pHand, newCard];
        setPHand(newHand);
        if(getScore(newHand) > 21) {
             setStatus('bust');
             setNotification({ type: 'LOSS', msg: 'BUST' });
        }
    };

    const stand = async () => {
        let dScore = getScore(dHand);
        // Quick visual simulation of dealer drawing
        while(dScore < 17) dScore += Math.floor(Math.random()*10)+1; 
        
        const pScore = getScore(pHand);
        let result = 'LOSE';
        let mult = 0;

        if (dScore > 21 || pScore > dScore) { result='WIN'; mult=2; }
        else if (pScore === dScore) { result='PUSH'; mult=1; }

        if(mult > 0) {
            await axios.post(`${API}/blackjack/payout`, { userId: user._id, bet, multiplier: mult });
            setNotification({ type: result, msg: result });
        } else {
            setNotification({ type: 'LOSS', msg: 'DEALER WINS' });
        }
        setStatus('idle');
    };

    return (
        <div className="game-wrapper">
            <div className="bj-board">
                <div className="hand dealer">
                   <h3>DEALER</h3>
                   <div className="cards">
                       {dHand.map((c, i) => (
                           <img key={i} src={(i===1 && status==='playing') ? 'https://deckofcardsapi.com/static/img/back.png' : c.image} className="card-img" alt="card" />
                       ))}
                   </div>
                </div>
                <div className="hand player">
                   <h3>YOU ({getScore(pHand)})</h3>
                   <div className="cards">
                       {pHand.map((c, i) => <img key={i} src={c.image} className="card-img" alt="card" />)}
                   </div>
                </div>
            </div>
            <div className="game-controls">
                {status === 'idle' || status === 'bust' ? (
                     <button className="action-btn gold" onClick={deal}>DEAL (${bet})</button>
                ) : (
                    <>
                        <button className="action-btn" onClick={hit}>HIT</button>
                        <button className="action-btn gold" onClick={stand}>STAND</button>
                    </>
                )}
            </div>
        </div>
    );
};

// --- MAIN APP ---
function App() {
  const [user, setUser] = useState(null);
  const [activeGame, setActiveGame] = useState('MINES');
  const [notify, setNotify] = useState(null);

  // Auth Handler
  const handleLogin = (response) => {
    axios.post(`${API}/auth/google`, { token: response.credential })
         .then(res => setUser(res.data))
         .catch(err => alert("Login Failed"));
  };

  useEffect(() => {
    /* global google */
    if (window.google) {
      google.accounts.id.initialize({
        client_id: "67123336647-b00rcsb6ni8s8unhi3qqg0bk6l2es62l.apps.googleusercontent.com",
        callback: handleLogin
      });
      google.accounts.id.renderButton(
        document.getElementById("gBtn"), { theme: "filled_black", size: "large", width: 250 }
      );
    }
    
    socket.on('balanceUpdate', (data) => {
        if(user && data.userId === user._id) setUser({...user, balance: data.balance});
    });
  }, [user]);

  // Notification Timer
  useEffect(() => {
      if(notify) {
          const timer = setTimeout(() => setNotify(null), 3000);
          return () => clearTimeout(timer);
      }
  }, [notify]);

  return (
    <div className="app-container">
      {/* SIDEBAR */}
      <nav className="sidebar">
        <h1 className="logo">GUMBLE<span className="text-gold">VIP</span></h1>
        
        <div className="nav-links">
            {['MINES', 'BLACKJACK', 'DRAGON', 'KENO'].map(g => (
                <button key={g} 
                        className={`nav-btn ${activeGame===g ? 'active' : ''}`}
                        onClick={() => setActiveGame(g)}>{g}</button>
            ))}
        </div>

        {user && (
            <div className="wallet-box">
                <p>BALANCE</p>
                <h2 className="text-gold">${user.balance.toFixed(2)}</h2>
            </div>
        )}
      </nav>

      {/* MAIN STAGE */}
      <main className="stage">
          {!user ? (
              <div className="login-modal">
                  <h1>VIP ACCESS ONLY</h1>
                  <div id="gBtn"></div>
              </div>
          ) : (
              <>
                <header className="top-hud">
                    <h2>{activeGame}</h2>
                    <div className="user-badge">{user.name}</div>
                </header>
                
                <div className="game-area">
                    {activeGame === 'MINES' && <MinesGame user={user} setNotification={setNotify} />}
                    {activeGame === 'BLACKJACK' && <BlackjackGame user={user} setNotification={setNotify} />}
                    {activeGame === 'DRAGON' && <div className="coming-soon">DRAGON TOWER LOADING...</div>}
                    {activeGame === 'KENO' && <div className="coming-soon">KENO LOADING...</div>}
                </div>
              </>
          )}
      </main>

      {/* NOTIFICATION POPUP */}
      {notify && (
          <div className="notify-overlay">
              <div className="notify-box">
                  <h1 className={notify.type === 'WIN' ? 'text-gold' : 'text-red'}>{notify.type}</h1>
                  <p>{notify.msg}</p>
              </div>
          </div>
      )}
    </div>
  );
}

export default App;