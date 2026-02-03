import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';

// --- STAKE-STYLE HD CARD ---
const Card = ({ value, suit }) => {
  if (!value) return <div className="card back"></div>;
  const color = (suit === 'h' || suit === 'd') ? 'red' : 'black';
  const symbol = { 'h': '♥', 'd': '♦', 's': '♠', 'c': '♣' };
  return (
    <div className={`card ${color}`}>
      <div className="val">{value}</div>
      <div className="suit">{symbol[suit] || suit}</div>
    </div>
  );
};

// Connect to Backend
const socket = io.connect("https://gumble-backend.onrender.com");

function App() {
  // Login States
  const [user, setUser] = useState(null); // The actual logged in user
  const [usernameInput, setUsernameInput] = useState(""); // What you are typing
  const [roomInput, setRoomInput] = useState("");
  
  // Game States
  const [room, setRoom] = useState("");
  const [gameState, setGameState] = useState({ 
    players: [], 
    pot: 0, 
    communityCards: [], 
    currentTurn: 0,
    phase: 'waiting'
  });

  useEffect(() => {
    // 1. Auto-fill Room from URL
    const params = new URLSearchParams(window.location.search);
    const inviteRoom = params.get("room");
    if (inviteRoom) setRoomInput(inviteRoom);

    // 2. Listen for Server Updates
    socket.on("update_room", (data) => {
      console.log("🔥 Game Update:", data);
      setGameState(data);
    });

    socket.on("hand_result", (data) => {
      alert(`🏆 ${data.winner} wins $${data.winnings}! \nHand: ${data.handName}`);
    });

    return () => socket.off("update_room");
  }, []);

  // --- ACTIONS ---
  const handleLogin = () => {
    if (usernameInput.trim()) setUser(usernameInput);
  };

  const handleJoin = () => {
    if (user && roomInput) {
      setRoom(roomInput);
      socket.emit("join_room", { roomName: roomInput, username: user });
    }
  };

  const sendAction = (type, amount = 0) => {
    socket.emit("action", { roomName: room, type, amount });
  };

  // --- GAME HELPERS ---
  const players = gameState?.players || [];
  const me = players.find(p => p.username === user);
  const myIndex = players.findIndex(p => p.username === user);
  // Is it my turn?
  const isMyTurn = players[gameState.currentTurn]?.username === user;
  
  // Seat Rotation (Always puts ME at bottom center)
  const getSeatClass = (index) => {
    if (myIndex === -1) return `seat-${index}`; // Spectator view
    const total = players.length;
    // Calculate relative position
    const diff = (index - myIndex + total) % total; 
    
    // Map relative index to CSS classes (0=Bottom, 1=Left, 2=Top, 3=Right)
    if (diff === 0) return 'seat-bottom'; // Me
    if (total === 2 && diff === 1) return 'seat-top'; // Heads up opponent
    
    // For 3+ players
    if (diff === 1) return 'seat-left';
    if (diff === 2) return 'seat-top';
    return 'seat-right';
  };

  // --- 1. LOGIN SCREEN ---
  if (!user) return (
    <div className="stake-app centered">
      <div className="modal-panel">
        <h1 className="stake-title">GUMBLE<span>STAKE</span></h1>
        <input 
          className="stake-input" 
          placeholder="Enter Username" 
          value={usernameInput}
          onChange={(e) => setUsernameInput(e.target.value)} 
        />
        <button className="stake-btn primary" onClick={handleLogin}>CONTINUE</button>
      </div>
    </div>
  );

  // --- 2. LOBBY SCREEN ---
  if (!room) return (
    <div className="stake-app centered">
      <div className="modal-panel">
        <h2>LOBBY</h2>
        <input 
          className="stake-input" 
          placeholder="Room Name (e.g. VIP)" 
          value={roomInput}
          onChange={(e) => setRoomInput(e.target.value)}
        />
        <button className="stake-btn success" onClick={handleJoin}>JOIN TABLE</button>
      </div>
    </div>
  );

  // --- 3. GAME TABLE ---
  return (
    <div className="stake-app">
      <div className="top-bar">
        <div className="logo">GUMBLE<span>STAKE</span></div>
        <div className="room-tag">Room: {room}</div>
        <button className="invite-btn" onClick={() => {
          navigator.clipboard.writeText(`${window.location.origin}/?room=${room}`);
          alert("Invite Link Copied! Send it to your friend.");
        }}>🔗 Invite Friend</button>
      </div>

      <div className="arena">
        <div className="racetrack">
          
          <div className="pot-container">
            <div className="pot-label">POT</div>
            <div className="pot-amount">${gameState.pot}</div>
            <div style={{fontSize:'10px', color:'#555'}}>{gameState.phase}</div>
          </div>

          <div className="board-cards">
            {gameState.communityCards.map((c, i) => <Card key={i} value={c.value} suit={c.suit} />)}
          </div>

          {/* RENDER PLAYERS */}
          {players.map((p, i) => (
            <div key={i} className={`seat ${getSeatClass(i)} ${gameState.currentTurn === i ? 'acting' : ''}`}>
              <div className="avatar">
                 <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${p.username}`} alt="p"/>
              </div>
              <div className="player-tag">
                <div className="name">{p.username}</div>
                <div className="balance">${p.chips}</div>
              </div>
              {/* Show cards if it's ME or Showdown */}
              {(p.username === user || gameState.phase === 'showdown') ? (
                <div className="hole-cards">
                  {(p.hand || []).map((c, idx) => <Card key={idx} value={c.value} suit={c.suit} />)}
                </div>
              ) : (
                <div className="hole-cards">
                  <div className="card back" style={{width:'40px', height:'60px'}}></div>
                  <div className="card back" style={{width:'40px', height:'60px'}}></div>
                </div>
              )}
            </div>
          ))}
          
          {players.length < 2 && (
             <div className="waiting-msg">Waiting for players to join...</div>
          )}
        </div>
      </div>

      <div className="controls-area">
        {isMyTurn ? (
          <>
            <div className="bet-sliders">
               <button onClick={() => sendAction('raise', gameState.pot / 2)}>½ Pot</button>
               <button onClick={() => sendAction('raise', gameState.pot)}>Pot</button>
               <button onClick={() => sendAction('raise', me.chips)}>All In</button>
            </div>
            <div className="actions">
               <button className="btn-fold" onClick={() => sendAction('fold')}>FOLD</button>
               <button className="btn-check" onClick={() => sendAction('call')}>CHECK / CALL</button>
               <button className="btn-raise" onClick={() => sendAction('raise', 100)}>BET 100</button>
            </div>
          </>
        ) : (
          <div className="waiting-status">
            {players.length < 2 ? "Need 1 more player to start..." : `Waiting for ${players[gameState.currentTurn]?.username}...`}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;