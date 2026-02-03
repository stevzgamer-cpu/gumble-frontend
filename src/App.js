import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';

const socket = io("https://gumble-backend.onrender.com");

const getCardSrc = (code) => {
    if (!code || code === 'XX') return "https://www.deckofcardsapi.com/static/img/back.png";
    let rank = code[0] === 'T' ? '0' : code[0]; 
    return `https://www.deckofcardsapi.com/static/img/${rank}${code[1]}.png`;
};

function App() {
  const [user, setUser] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [buyIn, setBuyIn] = useState(100);
  const [raiseAmount, setRaiseAmount] = useState(20);
  const [walletAmount, setWalletAmount] = useState(0); // For deposit/withdraw
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

  const handleWallet = async (type) => {
      const res = await fetch(`https://gumble-backend.onrender.com/api/wallet`, {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({userId: user._id, amount: walletAmount, type})
      });
      const data = await res.json();
      if(res.ok) { setUser(data); setWalletAmount(0); alert("Transaction Successful!"); }
      else alert(data.error);
  };

  useEffect(() => {
    socket.on('gameState', setGameState);
    return () => socket.off('gameState');
  }, []);

  const joinGame = () => socket.emit('joinGame', { userId: user._id, buyIn });
  const leaveGame = () => { socket.emit('leaveGame'); setGameState(null); };

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

  if (!gameState || !gameState.players.find(p => p.name === user.username)) return (
      <div className="lobby-screen">
          <div className="lobby-box">
              <h1>Welcome, {user.username}</h1>
              <div className="balance-display">Wallet: ${user.balance}</div>
              
              {/* WALLET SECTION */}
              <div className="wallet-box">
                  <input type="number" placeholder="Amount" value={walletAmount} onChange={e=>setWalletAmount(e.target.value)} className="lux-input small" />
                  <div className="btn-row">
                      <button onClick={()=>handleWallet('deposit')} className="green-btn">DEPOSIT</button>
                      <button onClick={()=>handleWallet('withdraw')} className="red-btn">WITHDRAW</button>
                  </div>
              </div>

              <div className="stakes-box">
                  <p>Select Table Buy-in:</p>
                  <div className="btn-row">
                      <button onClick={()=>setBuyIn(50)} className={buyIn===50?"active":""}>$50</button>
                      <button onClick={()=>setBuyIn(100)} className={buyIn===100?"active":""}>$100</button>
                  </div>
                  <button className="gold-btn big" onClick={joinGame}>SIT AT TABLE</button>
              </div>
          </div>
      </div>
  );

  const mySeat = gameState.players.find(p => p.name === user.username);
  const isMyTurn = gameState.players[gameState.turnIndex]?.id === socket.id;

  return (
    <div className="game-screen">
        <div className="header-bar">
            <button className="leave-btn" onClick={leaveGame}>LEAVE & CASH OUT</button>
        </div>

        <div className="poker-table">
            <div className="table-center">
                <div className="pot-pill">POT: ${gameState.pot}</div>
                <div className="community-cards">
                    {gameState.communityCards.map((c, i) => (
                        <img key={i} src={getCardSrc(c)} className="real-card" alt={c} />
                    ))}
                </div>
                {gameState.phase === 'showdown' && <div className="winner-msg">SHOWDOWN!</div>}
            </div>

            {gameState.players.map((p, i) => {
                const isMe = p.name === user.username;
                const isTurn = gameState.players[gameState.turnIndex]?.id === p.id;
                return (
                    <div key={i} className={`seat seat-${i} ${isTurn ? 'active-turn' : ''}`}>
                         {isTurn && <div className="timer-bar" style={{width: `${(gameState.timer/30)*100}%`}}></div>}
                         <div className="avatar">{p.name[0]}</div>
                         <div className="p-info">
                             <div className="p-name">{p.name} {i === gameState.dealerIndex && "👑"}</div>
                             <div className="p-bal">${p.balance}</div>
                         </div>
                         <div className="hand">
                             {p.hand.map((c, j) => (
                                 <img key={j} src={getCardSrc(!isMe && gameState.phase !== 'showdown' ? 'XX' : c)} 
                                      className="real-card small" alt="card" />
                             ))}
                         </div>
                         {p.currentBet > 0 && <div className="bet-bubble">${p.currentBet}</div>}
                    </div>
                );
            })}
        </div>

        <div className={`controls-dock ${!isMyTurn ? 'disabled' : ''}`}>
            <div className="slider-box">
                <input type="range" min={gameState.highestBet} max={mySeat.balance} 
                       value={raiseAmount} onChange={(e)=>setRaiseAmount(Number(e.target.value))} />
                <span>Bet: ${raiseAmount}</span>
            </div>
            <div className="action-btns">
                <button className="act-btn fold" onClick={()=>socket.emit('action', {type:'fold'})}>FOLD</button>
                <button className="act-btn check" onClick={()=>socket.emit('action', {type:'call'})}>CALL / CHECK</button>
                <button className="act-btn raise" onClick={()=>socket.emit('action', {type:'raise', amount: raiseAmount})}>RAISE</button>
            </div>
        </div>
    </div>
  );
}

export default App;