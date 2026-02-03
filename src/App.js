import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';

const socket = io("https://gumble-backend.onrender.com");

const getCardSrc = (code) => {
    if (!code || code === 'XX' || code.length < 2) return "https://www.deckofcardsapi.com/static/img/back.png";
    let rank = code[0] === 'T' ? '0' : code[0];
    let suit = code[1].toUpperCase();
    return `https://www.deckofcardsapi.com/static/img/${rank}${suit}.png`;
};

function App() {
  const [user, setUser] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [buyIn, setBuyIn] = useState(100);
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [walletAmount, setWalletAmount] = useState(0); 
  const [isRegistering, setIsRegistering] = useState(false);

  // AUTH
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

  // WALLET
  const handleWallet = async (type) => {
      if (!walletAmount) return;
      const res = await fetch(`https://gumble-backend.onrender.com/api/wallet`, {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({userId: user._id, amount: walletAmount, type})
      });
      const data = await res.json();
      if(res.ok) { setUser(data); setWalletAmount(0); alert("Success!"); }
      else alert(data.error);
  };

  useEffect(() => {
    socket.on('gameState', (data) => {
        setGameState(data);
        // Default raise to min raise (highest bet + 20)
        if(data) setRaiseAmount(data.highestBet + 20);
    });
    return () => socket.off('gameState');
  }, []);

  const joinGame = () => socket.emit('joinGame', { userId: user._id, buyIn });
  const leaveGame = () => { socket.emit('leaveGame'); setGameState(null); };

  // --- SCREENS ---
  
  // 1. LOGIN
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
              </p>
          </div>
      </div>
  );

  // 2. LOBBY
  const myPlayer = gameState?.players.find(p => p.name === user.username);
  if (!gameState || !myPlayer) return (
      <div className="lobby-screen">
          <div className="lobby-box">
              <h1>Welcome, {user.username}</h1>
              <div className="balance-display">Wallet: ${user.balance}</div>
              <div className="wallet-box">
                  <input type="number" placeholder="Amount" value={walletAmount} onChange={e=>setWalletAmount(e.target.value)} className="lux-input small" />
                  <div className="btn-row">
                      <button onClick={()=>handleWallet('deposit')} className="green-btn">DEPOSIT</button>
                      <button onClick={()=>handleWallet('withdraw')} className="red-btn">WITHDRAW</button>
                  </div>
              </div>
              <div className="stakes-box">
                  <div className="btn-row">
                      <button onClick={()=>setBuyIn(50)} className={buyIn===50?"active":""}>$50</button>
                      <button onClick={()=>setBuyIn(100)} className={buyIn===100?"active":""}>$100</button>
                  </div>
                  <button className="gold-btn big" onClick={joinGame}>SIT AT TABLE</button>
              </div>
          </div>
      </div>
  );

  // 3. TABLE VARIABLES (Calculated SAFELY outside HTML)
  const isMyTurn = gameState.players[gameState.turnIndex]?.id === socket.id;
  const currentBet = myPlayer.currentBet || 0;
  const toCall = gameState.highestBet - currentBet;
  const canCheck = toCall === 0;

  return (
    <div className="game-screen">
        <div className="header-bar">
            <button className="leave-btn" onClick={leaveGame}>LEAVE TABLE</button>
        </div>

        <div className="poker-table">
            {/* CENTER INFO */}
            <div className="table-center">
                <div className="pot-pill">POT: ${gameState.pot}</div>
                <div className="community-cards">
                    {gameState.communityCards.map((c, i) => (
                        <img key={i} src={getCardSrc(c)} className="real-card" alt="card" />
                    ))}
                </div>
                {gameState.phase === 'showdown' && <div className="winner-msg">SHOWDOWN!</div>}
            </div>

            {/* SEATS LOOP */}
            {gameState.players.map((p, i) => {
                // Determine Seat Index
                const isMe = p.name === user.username;
                let isTurn = false;
                if (gameState.players[gameState.turnIndex] && gameState.players[gameState.turnIndex].id === p.id) {
                    isTurn = true;
                }

                // Timer Math
                let timerStyle = { width: "0%" };
                if (isTurn) {
                    let percent = (gameState.timer / 30) * 100;
                    timerStyle = { width: percent + "%" };
                }

                return (
                    <div key={i} className={`seat seat-${i} ${isTurn ? 'active-turn' : ''} ${p.folded ? 'folded' : ''}`}>
                         {isTurn && <div className="timer-bar" style={timerStyle}></div>}
                         
                         <div className="avatar">{p.name[0]}</div>
                         <div className="p-info">
                             <div className="p-name">{p.name} {i === gameState.dealerIndex && "👑"}</div>
                             <div className="p-bal">${p.balance}</div>
                         </div>
                         
                         <div className="hand">
                             {p.hand.map((c, j) => (
                                 <img key={j} src={getCardSrc((isMe || gameState.phase === 'showdown') ? c : 'XX')} 
                                      className="real-card small" alt="card" />
                             ))}
                         </div>
                         {p.currentBet > 0 && <div className="bet-bubble">${p.currentBet}</div>}
                    </div>
                );
            })}
        </div>

        {/* CONTROLS (Only visible if my turn) */}
        <div className={`controls-dock ${!isMyTurn ? 'disabled' : ''}`}>
            <div className="slider-box">
                <input type="range" min={gameState.highestBet + 10} max={myPlayer.balance + currentBet} 
                       value={raiseAmount} onChange={(e)=>setRaiseAmount(Number(e.target.value))} />
                <span>Raise To: ${raiseAmount}</span>
            </div>
            <div className="action-btns">
                <button className="act-btn fold" onClick={()=>socket.emit('action', {type:'fold'})}>FOLD</button>
                
                {canCheck ? (
                    <button className="act-btn check" onClick={()=>socket.emit('action', {type:'call'})}>CHECK</button>
                ) : (
                    <button className="act-btn check" onClick={()=>socket.emit('action', {type:'call'})}>CALL ${toCall}</button>
                )}

                <button className="act-btn raise" onClick={()=>socket.emit('action', {type:'raise', amount: raiseAmount})}>RAISE</button>
            </div>
        </div>
    </div>
  );
}

export default App;