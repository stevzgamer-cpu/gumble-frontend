import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { io } from "socket.io-client";
import axios from 'axios';

// AUTO-DETECT BACKEND URL
const IS_LOCAL = window.location.hostname === 'localhost';
const BACKEND = IS_LOCAL ? 'http://localhost:5000' : 'https://gumble-backend.onrender.com';
const API = `${BACKEND}/api`;
const socket = io(BACKEND);

// --- COMPONENT: MINES ---
const Mines = ({ user, setNotify }) => {
    const [bet, setBet] = useState(10);
    const [mines, setMines] = useState(3);
    const [active, setActive] = useState(false);
    const [grid, setGrid] = useState([]); 
    const [revealed, setRevealed] = useState(Array(25).fill(false));
    const [mult, setMult] = useState(1.0);

    const play = async () => {
        try {
            const res = await axios.post(`${API}/mines/play`, { userId: user._id, bet, minesCount: mines });
            setGrid(res.data.grid); setActive(true); setRevealed(Array(25).fill(false)); setMult(1.0);
        } catch(e) { alert("Funds!"); }
    };

    const click = (i) => {
        if(!active || revealed[i]) return;
        const rev = [...revealed]; rev[i] = true; setRevealed(rev);
        if(grid[i]===1) { setActive(false); setNotify({t:'LOSE', m:'BOOM!'}); }
        else { setMult(mult * 1.15); }
    };

    const cashout = async () => {
        const win = bet * mult;
        await axios.post(`${API}/mines/cashout`, { userId: user._id, winAmount: win });
        setActive(false); setNotify({t:'WIN', m:`+ $${win.toFixed(2)}`});
    };

    return (
        <div className="game-wrapper">
            <div className="controls">
                <input type="number" value={bet} onChange={e=>setBet(Number(e.target.value))} />
                <button className="btn-gold" onClick={!active ? play : cashout}>
                    {!active ? 'BET' : `CASHOUT $${(bet*mult).toFixed(2)}`}
                </button>
            </div>
            <div className="grid-5x5">
                {Array(25).fill(0).map((_,i) => (
                    <div key={i} className={`tile ${revealed[i] ? (grid[i]===1?'bomb':'gem'):''}`} onClick={()=>click(i)}>
                        {revealed[i] ? (grid[i]===1?'💥':'💎') : ''}
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- COMPONENT: BLACKJACK ---
const Blackjack = ({ user, setNotify }) => {
    const [bet, setBet] = useState(20);
    const [ph, setPh] = useState([]);
    const [dh, setDh] = useState([]);
    const [status, setStatus] = useState('idle');

    const score = (h) => {
        let s=0, a=0; h.forEach(c=>{s+=c.value; if(c.value===11)a++});
        while(s>21 && a>0){s-=10;a--} return s;
    };

    const deal = async () => {
        const res = await axios.post(`${API}/blackjack/deal`, {userId: user._id, bet});
        setPh(res.data.playerHand); setDh(res.data.dealerHand); setStatus('play');
    };

    const hit = async () => {
        const res = await axios.post(`${API}/blackjack/hit`, {});
        const nh = [...ph, res.data.card]; setPh(nh);
        if(score(nh)>21) { setStatus('bust'); setNotify({t:'LOSE', m:'BUST'}); }
    };

    const stand = async () => {
        let d = [...dh];
        // Simulate dealer draw (simplified frontend visual)
        while(score(d)<17) {
             // In full prod, fetch from server. Here we assume success for UI speed
             d.push({code:'X', value:5, image:'https://deckofcardsapi.com/static/img/5D.png'}); 
        }
        setDh(d);
        const ps=score(ph), ds=score(d);
        let win=0;
        if(ds>21 || ps>ds) win=bet*2;
        else if(ps===ds) win=bet;
        
        if(win>0) {
            await axios.post(`${API}/blackjack/payout`, {userId:user._id, amount:win});
            setNotify({t:'WIN', m:`+ $${win}`});
        } else setNotify({t:'LOSE', m:'DEALER WINS'});
        setStatus('idle');
    };

    return (
        <div className="game-wrapper bj-layout">
            <div className="hand">
                <h3>DEALER ({status==='play'?'?':score(dh)})</h3>
                <div className="cards">{dh.map((c,i)=><img key={i} src={(i===1&&status==='play')?'https://deckofcardsapi.com/static/img/back.png':c.image} className="card"/>)}</div>
            </div>
            <div className="hand">
                <h3>YOU ({score(ph)})</h3>
                <div className="cards">{ph.map((c,i)=><img key={i} src={c.image} className="card"/>)}</div>
            </div>
            <div className="controls">
                {status==='idle'||status==='bust' ? 
                    <button className="btn-gold" onClick={deal}>DEAL ${bet}</button> : 
                    <><button className="btn" onClick={hit}>HIT</button><button className="btn-gold" onClick={stand}>STAND</button></>
                }
            </div>
        </div>
    );
};

// --- COMPONENT: DRAGON TOWER ---
const DragonTower = ({ user, setNotify }) => {
    const [bet, setBet] = useState(10);
    const [active, setActive] = useState(false);
    const [rows, setRows] = useState([]); // Server truth
    const [currentRow, setCurrentRow] = useState(0);
    const [history, setHistory] = useState(Array(9).fill(null)); // UI State
    const [diff, setDiff] = useState('MEDIUM');

    const play = async () => {
        const res = await axios.post(`${API}/dragon/play`, { userId: user._id, bet, difficulty: diff });
        setRows(res.data.rows); setActive(true); setCurrentRow(0); setHistory(Array(9).fill(null));
    };

    const select = (colIndex) => {
        if(!active) return;
        const isDragon = rows[currentRow][colIndex] === 1;
        const newHist = [...history];
        newHist[currentRow] = isDragon ? '💥' : '🥚'; // Egg = Safe
        setHistory(newHist);

        if(isDragon) {
            setActive(false); setNotify({t:'LOSE', m:'DRAGON ATE YOU'});
        } else {
            if(currentRow === 8) {
                // Top reached
                cashout(true);
            } else {
                setCurrentRow(currentRow + 1);
            }
        }
    };

    const cashout = async (top=false) => {
        let multi = 1 + (currentRow * 0.5); // Simple mult math
        if(top) multi = 10;
        const win = bet * multi;
        await axios.post(`${API}/dragon/cashout`, { userId: user._id, amount: win });
        setActive(false); setNotify({t:'WIN', m:`+ $${win.toFixed(2)}`});
    };

    return (
        <div className="game-wrapper tower-layout">
            <div className="tower-grid">
                {[...Array(9)].map((_, rIdx) => {
                    const actualRow = 8 - rIdx; // Render bottom (0) to top (8)
                    return (
                        <div key={actualRow} className={`tower-row ${actualRow===currentRow ? 'active-row':''}`}>
                            {[0,1,2].map(c => (
                                <div key={c} className="tower-cell" onClick={()=>actualRow===currentRow && select(c)}>
                                    {history[actualRow] !== null && currentRow > actualRow ? '🥚' : ''}
                                    {history[actualRow] !== null && currentRow === actualRow && history[actualRow]}
                                </div>
                            ))}
                        </div>
                    )
                })}
            </div>
            <div className="controls">
                <select value={diff} onChange={e=>setDiff(e.target.value)} disabled={active}>
                    <option>EASY</option><option>MEDIUM</option><option>HARD</option>
                </select>
                <input type="number" value={bet} onChange={e=>setBet(Number(e.target.value))} />
                <button className="btn-gold" onClick={!active ? play : ()=>cashout(false)}>
                    {!active ? 'CLIMB' : 'CASHOUT'}
                </button>
            </div>
        </div>
    );
};

// --- COMPONENT: KENO ---
const Keno = ({ user, setNotify }) => {
    const [bet, setBet] = useState(10);
    const [picks, setPicks] = useState([]);
    const [drawn, setDrawn] = useState([]);
    
    const toggle = (n) => {
        if(picks.includes(n)) setPicks(picks.filter(x=>x!==n));
        else if(picks.length < 10) setPicks([...picks, n]);
    };

    const play = async () => {
        if(picks.length === 0) return;
        const res = await axios.post(`${API}/keno/play`, { userId: user._id, bet, picks });
        setDrawn(res.data.drawn);
        if(res.data.win > 0) setNotify({t:'WIN', m:`+ $${res.data.win.toFixed(2)}`});
        else setNotify({t:'LOSE', m:'NO MATCH'});
    };

    return (
        <div className="game-wrapper keno-layout">
            <div className="keno-grid">
                {[...Array(40)].map((_,i) => {
                    const n = i+1;
                    const isPick = picks.includes(n);
                    const isHit = drawn.includes(n);
                    return (
                        <div key={n} 
                             className={`keno-ball ${isPick?'pick':''} ${isHit?'hit':''}`}
                             onClick={()=>toggle(n)}>
                             {n}
                        </div>
                    )
                })}
            </div>
            <div className="controls">
                <input type="number" value={bet} onChange={e=>setBet(Number(e.target.value))} />
                <button className="btn-gold" onClick={play}>DRAW</button>
            </div>
        </div>
    );
};

// --- MAIN APP ---
function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('MINES');
  const [notify, setNotify] = useState(null);

  const handleLogin = (response) => {
    axios.post(`${API}/auth/google`, { token: response.credential })
         .then(res => setUser(res.data))
         .catch(()=> alert("Login Error"));
  };

  useEffect(() => {
    // RETRY LOGIC FOR GOOGLE BUTTON
    const initGoogle = () => {
        if (window.google) {
            window.google.accounts.id.initialize({
                client_id: "67123336647-b00rcsb6ni8s8unhi3qqg0bk6l2es62l.apps.googleusercontent.com",
                callback: handleLogin
            });
            const btn = document.getElementById("gBtn");
            if(btn) window.google.accounts.id.renderButton(btn, { theme: "filled_black", size: "large", width: 250 });
        } else {
            setTimeout(initGoogle, 500); // Try again in 500ms if script not loaded
        }
    };
    initGoogle();
    
    socket.on('balanceUpdate', (d) => {
        if(user && d.userId===user._id) setUser({...user, balance: d.balance});
    });
  }, [user]);

  useEffect(()=>{ if(notify) setTimeout(()=>setNotify(null), 3000); },[notify]);

  return (
    <div className="app">
      <nav className="sidebar">
        <h1 className="logo">GUMBLE<span className="gold">VIP</span></h1>
        {['MINES', 'BLACKJACK', 'DRAGON', 'KENO'].map(g => (
            <button key={g} className={`nav-item ${page===g?'active':''}`} onClick={()=>setPage(g)}>{g}</button>
        ))}
        {user && <div className="balance-box">BALANCE <br/><span className="gold">${user.balance.toFixed(2)}</span></div>}
      </nav>

      <main className="stage">
          {!user ? (
              <div className="login-container">
                  <h1 className="gold">VIP ACCESS ONLY</h1>
                  <p>Secure connection required.</p>
                  <div id="gBtn" style={{marginTop: '20px'}}></div> 
              </div>
          ) : (
              <>
                <header className="header">
                    <h2>{page}</h2>
                    <div>{user.name}</div>
                </header>
                <div className="game-area">
                    {page === 'MINES' && <Mines user={user} setNotify={setNotify} />}
                    {page === 'BLACKJACK' && <Blackjack user={user} setNotify={setNotify} />}
                    {page === 'DRAGON' && <DragonTower user={user} setNotify={setNotify} />}
                    {page === 'KENO' && <Keno user={user} setNotify={setNotify} />}
                </div>
              </>
          )}
      </main>

      {notify && <div className="notify"><h1 className="gold">{notify.t}</h1><p>{notify.m}</p></div>}
    </div>
  );
}

export default App;