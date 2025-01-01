import React, { useState, useEffect, useCallback, useRef, memo } from 'react';

// Game constants
const GAME_WIDTH = 800;
const GAME_HEIGHT = 550;
const BUILDING_COUNT = 8;
const TARGET_SCORE = 10000;
const INITIAL_LETTER_SPEED = 0.8;
const INITIAL_SPAWN_INTERVAL = 2000;
const MAX_PARTICLES = 50;

// Letter configuration
const LETTER_TYPES = {
  NORMAL: { 
    color: '#00ff00', 
    points: 100, 
    probability: 0.65,
    particleCount: 8,
    glowColor: '0 0 10px #00ff00'
  },
  FAST: { 
    color: '#ff0000', 
    points: 200, 
    probability: 0.15,
    particleCount: 12,
    glowColor: '0 0 15px #ff0000'
  },
  BONUS: { 
    color: '#ffff00', 
    points: 300, 
    probability: 0.12,
    particleCount: 15,
    glowColor: '0 0 20px #ffff00'
  },
  POWER: { 
    color: '#00ffff', 
    points: 150, 
    probability: 0.08,
    particleCount: 20,
    glowColor: '0 0 25px #00ffff'
  }
};

// Memoized components for better performance
const Grid = memo(() => (
  <g>
    <defs>
      <linearGradient id="gridGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ff61ef" stopOpacity="0.05" />
        <stop offset="100%" stopColor="#ff61ef" stopOpacity="0.2" />
      </linearGradient>
    </defs>
    {Array.from({ length: 20 }).map((_, i) => (
      <line
        key={`grid-${i}`}
        x1={0}
        y1={GAME_HEIGHT - (i * 30)}
        x2={GAME_WIDTH}
        y2={GAME_HEIGHT - (i * 30)}
        stroke="url(#gridGradient)"
        strokeWidth="1"
      />
    ))}
  </g>
));

const Building = memo(({ building, GAME_HEIGHT }) => {
  if (building.destroyed) return null;
  return (
    <g className={building.shaking ? 'building-shake' : ''}>
      <rect
        x={building.x}
        y={GAME_HEIGHT - building.height}
        width={building.width}
        height={building.height}
        fill="#ff61ef"
        stroke="#ff00ff"
        strokeWidth="2"
        opacity={0.8 * (building.health / 3)}
        style={{
          filter: 'drop-shadow(0 0 10px #ff61ef)',
        }}
      />
      {Array.from({ length: building.health }).map((_, i) => (
        <rect
          key={i}
          x={building.x + 2}
          y={GAME_HEIGHT - building.height - 8 + (i * 4)}
          width={building.width - 4}
          height="2"
          fill="#00ff00"
          style={{ filter: 'drop-shadow(0 0 3px #00ff00)' }}
        />
      ))}
    </g>
  );
});

const Letter = memo(({ letter }) => (
  <text
    x="0"
    y="0"
    fill={letter.type.color}
    fontSize="24"
    fontFamily="monospace"
    textAnchor="middle"
    style={{ filter: `drop-shadow(${letter.type.glowColor})` }}
    transform={`translate(${letter.x},${letter.y}) rotate(${letter.rotation}) scale(${letter.scale})`}
  >
    {letter.char}
  </text>
));

const Particle = memo(({ particle }) => (
  <circle
    cx={particle.x}
    cy={particle.y}
    r={particle.size}
    fill={particle.color}
    opacity={particle.life}
    style={{ filter: `drop-shadow(${particle.color} 0 0 5px)` }}
  />
));

// Main game component
const NeonDefense = () => {
  const [gameState, setGameState] = useState({
    score: 0,
    level: 1,
    combo: 0,
    cityHealth: 100,
    highScore: 0,
    lastComboTime: 0,
    lastPoints: 0,
    isActive: false,
    gameOver: false,
    victory: false,
    powerUpActive: false
  });
  
  const [buildings, setBuildings] = useState([]);
  const [letters, setLetters] = useState([]);
  const [particles, setParticles] = useState([]);
  const [shake, setShake] = useState(false);
  
  const gameRef = useRef(null);
  const comboTimeout = useRef(null);
  const shakeTimeout = useRef(null);

  // Initialize buildings
  useEffect(() => {
    const newBuildings = Array.from({ length: BUILDING_COUNT }, (_, i) => ({
      id: i,
      width: 30 + Math.random() * 40,
      height: 100 + Math.random() * 200,
      x: (i * GAME_WIDTH) / BUILDING_COUNT + 10,
      destroyed: false,
      health: 3
    }));
    setBuildings(newBuildings);
  }, []);

  // Particle system with optimized updates
  useEffect(() => {
    if (!gameState.isActive || particles.length === 0) return;

    const particleLoop = setInterval(() => {
      setParticles(prev => 
        prev
          .map(p => ({
            ...p,
            x: p.x + p.velocity.x,
            y: p.y + p.velocity.y,
            velocity: {
              x: p.velocity.x * 0.98,
              y: p.velocity.y * 0.98 + 0.2
            },
            life: p.life - 0.02
          }))
          .filter(p => p.life > 0)
          .slice(0, MAX_PARTICLES)
      );
    }, 16);

    return () => clearInterval(particleLoop);
  }, [gameState.isActive, particles]);

  // Letter spawning system
  useEffect(() => {
    if (!gameState.isActive || gameState.gameOver || gameState.victory) return;

    const spawnInterval = INITIAL_SPAWN_INTERVAL * Math.pow(0.95, gameState.level - 1);
    const letterSpeed = INITIAL_LETTER_SPEED * Math.pow(1.1, gameState.level - 1);

    const spawnTimer = setInterval(() => {
      const letterType = Object.values(LETTER_TYPES).find(type => 
        Math.random() < type.probability
      ) || LETTER_TYPES.NORMAL;

      setLetters(prev => [...prev, {
        id: Date.now(),
        char: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)],
        type: letterType,
        x: Math.random() * (GAME_WIDTH - 20),
        y: 0,
        rotation: Math.random() * 360,
        scale: 1,
        speed: letterSpeed * (letterType === LETTER_TYPES.FAST ? 1.5 : 1)
      }]);
    }, spawnInterval);

    return () => clearInterval(spawnTimer);
  }, [gameState.isActive, gameState.level, gameState.gameOver, gameState.victory]);

  // Letter movement and collision
  useEffect(() => {
    if (!gameState.isActive || gameState.gameOver || gameState.victory) return;

    const gameLoop = setInterval(() => {
      setLetters(prev => 
        prev.map(letter => ({
          ...letter,
          y: letter.y + (letter.speed * (gameState.powerUpActive ? 0.5 : 1)),
          rotation: letter.rotation + 1,
          scale: 1 + Math.sin(Date.now() / 200) * 0.1
        })).filter(letter => {
          if (letter.y >= GAME_HEIGHT - 20) {
            handleLetterCollision(letter);
            return false;
          }
          return true;
        })
      );
    }, 16);

    return () => clearInterval(gameLoop);
  }, [gameState, buildings]);

  // Handle letter collision
  const handleLetterCollision = useCallback((letter) => {
    const hitBuildingIndex = buildings.findIndex(building => 
      !building.destroyed && 
      letter.x >= building.x && 
      letter.x <= building.x + building.width
    );

    if (hitBuildingIndex !== -1) {
      setBuildings(prev => prev.map((b, i) => {
        if (i === hitBuildingIndex) {
          const newHealth = b.health - 1;
          if (newHealth <= 0) {
            createExplosion(b.x + b.width / 2, GAME_HEIGHT - b.height / 2);
            setGameState(prev => ({
              ...prev,
              cityHealth: Math.max(0, prev.cityHealth - 10)
            }));
          }
          return { 
            ...b, 
            health: newHealth,
            destroyed: newHealth <= 0,
            shaking: true
          };
        }
        return b;
      }));
    }
  }, [buildings]);

  // Create explosion particles
  const createExplosion = useCallback((x, y) => {
    const newParticles = Array(20).fill(null).map(() => ({
      id: Math.random(),
      x,
      y,
      color: '#ff61ef',
      velocity: {
        x: (Math.random() - 0.5) * 8,
        y: (Math.random() - 4) * 4
      },
      life: 1,
      size: 4 + Math.random() * 4
    }));
    setParticles(prev => [...prev, ...newParticles].slice(0, MAX_PARTICLES));
    setShake(true);
    if (shakeTimeout.current) clearTimeout(shakeTimeout.current);
    shakeTimeout.current = setTimeout(() => setShake(false), 200);
  }, []);

  // Handle keyboard input
  const handleKeyPress = useCallback((e) => {
    if (!gameState.isActive || gameState.gameOver || gameState.victory) return;
    
    const key = e.key.toUpperCase();
    const letterIndex = letters.findIndex(l => l.char === key);
    
    if (letterIndex !== -1) {
      const letter = letters[letterIndex];
      const now = Date.now();
      const newCombo = now - gameState.lastComboTime < 1000 ? gameState.combo + 1 : 1;
      const points = letter.type.points * Math.min(newCombo, 10);

      createExplosion(letter.x, letter.y);
      
      setLetters(prev => prev.filter((_, i) => i !== letterIndex));
      setGameState(prev => ({
        ...prev,
        score: prev.score + points,
        combo: newCombo,
        lastComboTime: now,
        lastPoints: points,
        powerUpActive: letter.type === LETTER_TYPES.POWER ? true : prev.powerUpActive
      }));

      if (comboTimeout.current) clearTimeout(comboTimeout.current);
      comboTimeout.current = setTimeout(() => {
        setGameState(prev => ({ ...prev, combo: 0 }));
      }, 1000);
    }
  }, [gameState, letters, createExplosion]);

  // Initialize keyboard events
  useEffect(() => {
    window.addEventListener('keypress', handleKeyPress);
    return () => window.removeEventListener('keypress', handleKeyPress);
  }, [handleKeyPress]);

  // Reset game state
  const resetGame = useCallback(() => {
    setGameState(prev => ({
      score: 0,
      level: 1,
      combo: 0,
      cityHealth: 100,
      highScore: Math.max(prev.score, prev.highScore),
      lastComboTime: 0,
      lastPoints: 0,
      isActive: false,
      gameOver: false,
      victory: false,
      powerUpActive: false
    }));
    setLetters([]);
    setParticles([]);
    setBuildings(Array.from({ length: BUILDING_COUNT }, (_, i) => ({
      id: i,
      width: 30 + Math.random() * 40,
      height: 100 + Math.random() * 200,
      x: (i * GAME_WIDTH) / BUILDING_COUNT + 10,
      destroyed: false,
      health: 3
    })));
  }, []);

  // Start game
  const startGame = useCallback(() => {
    if (!gameState.isActive) {
      setGameState(prev => ({ ...prev, isActive: true }));
      gameRef.current?.focus();
    }
  }, [gameState.isActive]);

  return (
    <div className="w-full h-full flex flex-col items-center bg-gray-900 text-white font-mono">
      <div className="mb-2 flex justify-between items-center w-full max-w-4xl px-4">
        <div>
          <h1 className="text-3xl font-bold text-pink-500 mb-1">NEON DEFENSE</h1>
          <div className="text-xl flex space-x-4">
            <span>Score: {gameState.score} / {TARGET_SCORE}</span>
            <span className="text-red-400">City: {gameState.cityHealth}%</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-cyan-400 text-xl">Level {gameState.level}</div>
          <div className="text-yellow-300 text-sm">Best: {gameState.highScore}</div>
          {gameState.powerUpActive && (
            <div className="text-yellow-300 animate-pulse">SLOW TIME</div>
          )}
        </div>
      </div>
      
      <div 
        ref={gameRef}
        tabIndex={0}
        onKeyPress={handleKeyPress}
        onClick={startGame}
        className={`relative focus:outline-none ${shake ? 'shake' : ''}`}
      >
        <svg 
          width={GAME_WIDTH} 
          height={GAME_HEIGHT} 
          className="border-2 border-pink-500"
          style={{
            background: 'linear-gradient(180deg, #2d1b4e 0%, #1a0b2e 100%)'
          }}
        >
          <Grid />
          
          {buildings.map(building => (
            <Building key={building.id} building={building} GAME_HEIGHT={GAME_HEIGHT} />
          ))}
          
          {letters.map(letter => (
            <Letter key={letter.id} letter={letter} />
          ))}
          
          {particles.map(particle => (
            <Particle key={particle.id} particle={particle} />
          ))}

          {gameState.victory && (
            <g className="dome-effect">
              <path
                d={`M 0 ${GAME_HEIGHT} A ${GAME_WIDTH / 2} ${GAME_HEIGHT / 2} 0 0 1 ${GAME_WIDTH} ${GAME_HEIGHT}`}
                fill="none"
                stroke="#00ffff"
                strokeWidth="4"
                opacity="0.8"
                style={{ filter: 'drop-shadow(0 0 20px #00ffff)' }}
              />
              <path
                d={`M 0 ${GAME_HEIGHT} A ${GAME_WIDTH / 2} ${GAME_HEIGHT / 2} 0 0 1 ${GAME_WIDTH} ${GAME_HEIGHT}`}
                fill="none"
                stroke="#00ffff"
                strokeWidth="2"
                opacity="0.4"
                className="animate-pulse"
              />
            </g>
          )}
        </svg>

        {/* Game start overlay */}
        {!gameState.isActive && !gameState.gameOver && !gameState.victory && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="text-center p-8 bg-gray-800 bg-opacity-90 rounded-lg border-2 border-pink-500">
              <h2 className="text-2xl text-cyan-400 mb-4">NEON DEFENSE</h2>
              <div className="space-y-2 text-lg">
                <p>Type the falling letters to protect your city!</p>
                <p className="text-green-400">Green letters: 100 pts</p>
                <p className="text-red-400">Red letters: 200 pts (faster)</p>
                <p className="text-yellow-400">Yellow letters: 300 pts</p>
                <p className="text-cyan-400">Cyan letters: Time slow power-up</p>
                <p className="mt-4">Chain hits for combo multipliers!</p>
                <p className="text-sm mt-4 text-pink-300">Click anywhere to start</p>
              </div>
            </div>
          </div>
        )}

        {/* Game over / victory overlay */}
        {(gameState.gameOver || gameState.victory) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70">
            <div className="text-center p-8 bg-gray-800 rounded-lg border-2 border-pink-500">
              {gameState.gameOver && (
                <div className="text-red-500 text-3xl mb-4">
                  GAME OVER<br/>
                  <span className="text-xl">City Health: {gameState.cityHealth}%</span>
                </div>
              )}
              {gameState.victory && (
                <div className="text-cyan-400 text-3xl mb-4">
                  VICTORY!<br/>
                  <span className="text-xl">The crystal dome protects the city</span>
                </div>
              )}
              <div className="mt-4 space-y-2">
                <div className="text-xl">Final Score: {gameState.score}</div>
                <div className="text-lg">Level Reached: {gameState.level}</div>
                {gameState.score > gameState.highScore && (
                  <div className="text-yellow-300">New High Score!</div>
                )}
              </div>
              <button 
                onClick={resetGame}
                className="mt-6 px-6 py-3 bg-pink-500 text-white rounded hover:bg-pink-600 transition-colors"
              >
                Play Again
              </button>
            </div>
          </div>
        )}

        {/* Combo display */}
        {gameState.combo > 1 && (
          <div className="absolute top-4 right-4 text-xl font-bold">
            <div className="text-yellow-300">{gameState.combo}x COMBO!</div>
            <div className="text-green-400">+{gameState.lastPoints}</div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeUp {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(-20px); }
        }

        .shake {
          animation: shake 0.1s linear;
        }

        .building-shake {
          animation: buildingShake 0.2s linear;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-2px); }
          75% { transform: translateX(2px); }
        }

        @keyframes buildingShake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-1px); }
          75% { transform: translateX(1px); }
        }

        .dome-effect {
          animation: domeAppear 1s ease-out;
        }

        @keyframes domeAppear {
          from { opacity: 0; transform: scaleY(0); }
          to { opacity: 1; transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
};

export default NeonDefense;
