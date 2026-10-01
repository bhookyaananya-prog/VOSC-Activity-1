import { useEffect, useRef, useState } from "react";
import "./App.css";

const players = [
  { name: "Red", color: "#ef3340", dark: "#b91c2c" },
  { name: "Green", color: "#19b978", dark: "#087f4f" },
  { name: "Yellow", color: "#ffc928", dark: "#c89500" },
  { name: "Blue", color: "#3478f6", dark: "#1755b5" },
];

const startOffsets = [0, 13, 26, 39];

const path = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7], [0, 8],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14], [8, 14],
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  [14, 7], [14, 6],
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1],
  [8, 0], [7, 0], [6, 0],
];

const safeCells = [0, 8, 13, 21, 26, 34, 39, 47];
const powerCells = [5, 13, 21, 29, 37, 45];

const powerAbilities = [
  {
    name: "BOOST",
    icon: "⚡",
    description: "Next move gets +2 steps.",
  },
  {
    name: "SHIELD",
    icon: "🛡️",
    description: "Protected from one capture.",
  },
  {
    name: "EXTRA TURN",
    icon: "🎯",
    description: "Play another turn.",
  },
];

function App() {
  const [tokens, setTokens] = useState([
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);

  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [dice, setDice] = useState(0);
  const [message, setMessage] = useState("Roll the dice to start!");
  const [gameMode, setGameMode] = useState("ai");

  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);

  const [rolling, setRolling] = useState(false);
  const [moving, setMoving] = useState(false);

  const [movingToken, setMovingToken] = useState(null);
  const [capturedToken, setCapturedToken] = useState(null);

  const [powerUps, setPowerUps] = useState([
    null,
    null,
    null,
    null,
  ]);

  const [powerPopup, setPowerPopup] = useState(null);
  const [soundOn, setSoundOn] = useState(true);
  const [demoMode, setDemoMode] = useState(false);

  const [stats, setStats] = useState(
    players.map(() => ({
      rolls: 0,
      captures: 0,
      finished: 0,
    }))
  );

  const [totalMoves, setTotalMoves] = useState(0);

  const audioContext = useRef(null);

  const player = players[currentPlayer];

  const isHumanTurn =
    gameMode === "ai"
      ? currentPlayer === 0
      : currentPlayer === 0 || currentPlayer === 1;

  const legalTokens =
    dice > 0
      ? movableTokens(currentPlayer, dice).map(
          (item) => item.index
        )
      : [];

  function getAudio() {
    if (!audioContext.current) {
      audioContext.current =
        new (window.AudioContext ||
          window.webkitAudioContext)();
    }

    return audioContext.current;
  }

  function playTone(
    frequency,
    duration = 0.12,
    type = "sine",
    volume = 0.07
  ) {
    if (!soundOn) return;

    try {
      const ctx = getAudio();

      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = type;
      oscillator.frequency.value = frequency;

      gain.gain.setValueAtTime(volume, ctx.currentTime);

      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + duration
      );

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.start();
      oscillator.stop(ctx.currentTime + duration);
    } catch {
      // Audio not available
    }
  }

  function playDiceSound() {
    playTone(250, 0.07, "square", 0.04);

    setTimeout(
      () => playTone(380, 0.07, "square", 0.04),
      80
    );

    setTimeout(
      () => playTone(520, 0.12, "square", 0.05),
      160
    );
  }

  function playMoveSound() {
    playTone(430, 0.055, "triangle", 0.045);
  }

  function playCaptureSound() {
    playTone(180, 0.14, "sawtooth", 0.06);

    setTimeout(
      () => playTone(100, 0.18, "sawtooth", 0.05),
      130
    );
  }

  function playPowerSound() {
    playTone(500, 0.09, "sine", 0.05);

    setTimeout(
      () => playTone(700, 0.09, "sine", 0.05),
      100
    );

    setTimeout(
      () => playTone(900, 0.15, "sine", 0.05),
      200
    );
  }

  function playWinSound() {
    [523, 659, 784, 1046].forEach(
      (note, index) => {
        setTimeout(
          () =>
            playTone(
              note,
              0.24,
              "triangle",
              0.07
            ),
          index * 150
        );
      }
    );
  }

  function wait(ms) {
    return new Promise((resolve) =>
      setTimeout(resolve, ms)
    );
  }

  function globalPosition(playerIndex, position) {
    if (position <= 0 || position > 52) {
      return null;
    }

    return (
      (startOffsets[playerIndex] +
        position -
        1) %
      52
    );
  }

  function movableTokens(playerIndex, roll) {
    return tokens[playerIndex]
      .map((position, index) => ({
        position,
        index,
      }))
      .filter(({ position }) => {
        if (position === 0) {
          return roll === 6;
        }

        return position + roll <= 52;
      });
  }

  function activatePowerTile(playerIndex) {
    const ability =
      powerAbilities[
        Math.floor(
          Math.random() * powerAbilities.length
        )
      ];

    if (ability.name !== "EXTRA TURN") {
      const updated = [...powerUps];

      updated[playerIndex] = ability.name;

      setPowerUps(updated);
    }

    setPowerPopup({
      ...ability,
      player: players[playerIndex].name,
    });

    playPowerSound();

    setTimeout(() => {
      setPowerPopup(null);
    }, 2200);

    return ability.name;
  }

  async function moveToken(
    tokenIndex,
    rollValue = dice
  ) {
    if (
      gameOver ||
      moving ||
      rollValue === 0
    ) {
      return;
    }

    const possible =
      movableTokens(
        currentPlayer,
        rollValue
      );

    if (
      !possible.some(
        (item) => item.index === tokenIndex
      )
    ) {
      return;
    }

    setMoving(true);

    setMovingToken({
      player: currentPlayer,
      token: tokenIndex,
    });

    let actualRoll = rollValue;

    if (
      powerUps[currentPlayer] ===
      "BOOST"
    ) {
      actualRoll += 2;

      const updated = [...powerUps];
      updated[currentPlayer] = null;

      setPowerUps(updated);

      setMessage(
        "⚡ BOOST! +2 extra steps!"
      );
    }

    let position =
      tokens[currentPlayer][tokenIndex];

    if (position === 0) {
      position = 1;

      const next = tokens.map(
        (group) => [...group]
      );

      next[currentPlayer][tokenIndex] =
        position;

      setTokens(next);

      playMoveSound();

      await wait(300);
    } else {
      for (
        let step = 1;
        step <= actualRoll;
        step++
      ) {
        position++;

        const animated = tokens.map(
          (group) => [...group]
        );

        animated[currentPlayer][
          tokenIndex
        ] = position;

        setTokens(animated);

        playMoveSound();

        await wait(150);
      }
    }

    const finalTokens = tokens.map(
      (group) => [...group]
    );

    finalTokens[currentPlayer][
      tokenIndex
    ] = position;

    const global =
      globalPosition(
        currentPlayer,
        position
      );

    let captured = false;
    let capturedInfo = null;

    if (
      global !== null &&
      !safeCells.includes(global)
    ) {
      finalTokens.forEach(
        (
          opponentTokens,
          opponentIndex
        ) => {
          if (
            opponentIndex ===
            currentPlayer
          ) {
            return;
          }

          if (
            gameMode === "2p" &&
            opponentIndex > 1
          ) {
            return;
          }

          opponentTokens.forEach(
            (
              opponentPosition,
              opponentToken
            ) => {
              const opponentGlobal =
                globalPosition(
                  opponentIndex,
                  opponentPosition
                );

              if (
                opponentGlobal === global &&
                opponentPosition > 0 &&
                powerUps[opponentIndex] !==
                  "SHIELD"
              ) {
                finalTokens[
                  opponentIndex
                ][opponentToken] = 0;

                captured = true;

                capturedInfo = {
                  player: opponentIndex,
                  token: opponentToken,
                };
              }
            }
          );
        }
      );
    }

    if (captured && capturedInfo) {
      setCapturedToken(
        capturedInfo
      );

      playCaptureSound();

      setStats((previous) => {
        const updated = previous.map(
          (item) => ({ ...item })
        );

        updated[currentPlayer]
          .captures++;

        return updated;
      });

      setMessage(
        "💥 CAPTURE! Opponent sent home!"
      );

      await wait(500);

      setCapturedToken(null);
    }

    setTokens(finalTokens);

    setTotalMoves(
      (previous) => previous + 1
    );

    let earnedPower = null;

    if (
      global !== null &&
      powerCells.includes(global)
    ) {
      earnedPower =
        activatePowerTile(
          currentPlayer
        );
    }

    if (position === 52) {
      setStats((previous) => {
        const updated = previous.map(
          (item) => ({ ...item })
        );

        updated[currentPlayer]
          .finished++;

        return updated;
      });

      setMessage(
        "🏠 Token reached HOME!"
      );
    }

    const finished =
      finalTokens[currentPlayer].filter(
        (value) => value === 52
      ).length;

    if (finished === 4) {
      setGameOver(true);
      setWinner(currentPlayer);
      setDice(0);
      setMoving(false);
      setMovingToken(null);

      playWinSound();

      setMessage(
        `🏆 ${player.name} WINS!`
      );

      return;
    }

    setMoving(false);
    setMovingToken(null);
    setDice(0);

    /*
      IMPORTANT:
      Capture/Kill now gives an extra turn.
      A six also gives an extra turn.
      EXTRA TURN power also gives an extra turn.
    */
    if (
      captured ||
      earnedPower === "EXTRA TURN" ||
      rollValue === 6
    ) {
      if (captured) {
        setMessage(
          "💥 CAPTURE! 🎯 Extra turn — roll again!"
        );
      } else if (
        earnedPower === "EXTRA TURN"
      ) {
        setMessage(
          "🎯 EXTRA TURN! Play again."
        );
      } else {
        setMessage(
          "🎉 Six! Roll again!"
        );
      }

      return;
    }

    const nextPlayer =
      gameMode === "2p"
        ? currentPlayer === 0
          ? 1
          : 0
        : (currentPlayer + 1) % 4;

    setCurrentPlayer(nextPlayer);
  }

  function rollDice() {
    if (
      gameOver ||
      rolling ||
      moving ||
      !isHumanTurn
    ) {
      return;
    }

    playDiceSound();
    setRolling(true);

    setStats((previous) => {
      const updated = previous.map(
        (item) => ({ ...item })
      );

      updated[currentPlayer].rolls++;

      return updated;
    });

    let value;

    /*
      DEMO MODE:
      40% chance of a six.
      Useful for your college presentation.
    */
    if (
      demoMode &&
      Math.random() < 0.4
    ) {
      value = 6;
    } else {
      value =
        Math.floor(
          Math.random() * 6
        ) + 1;
    }

    setTimeout(() => {
      setDice(value);
      setRolling(false);

      const movable =
        movableTokens(
          currentPlayer,
          value
        );

      if (movable.length === 0) {
        setMessage(
          `🎲 ${value} — no legal move.`
        );

        setTimeout(() => {
          setDice(0);

          if (value === 6) {
            setMessage(
              "🎉 Six! Roll again."
            );
          } else {
            const nextPlayer =
              gameMode === "2p"
                ? currentPlayer === 0
                  ? 1
                  : 0
                : (currentPlayer + 1) % 4;

            setCurrentPlayer(
              nextPlayer
            );
          }
        }, 800);

        return;
      }

      if (movable.length === 1) {
        setMessage(
          `🎲 ${value} — moving token...`
        );

        setTimeout(() => {
          moveToken(
            movable[0].index,
            value
          );
        }, 350);

        return;
      }

      setMessage(
        `🎲 ${value} — choose a glowing token.`
      );
    }, 450);
  }

  useEffect(() => {
    if (
      gameMode !== "ai" ||
      currentPlayer === 0 ||
      gameOver ||
      moving ||
      dice !== 0
    ) {
      return;
    }

    const timer = setTimeout(() => {
      playDiceSound();

      let aiRoll;

      if (
        demoMode &&
        Math.random() < 0.35
      ) {
        aiRoll = 6;
      } else {
        aiRoll =
          Math.floor(
            Math.random() * 6
          ) + 1;
      }

      setStats((previous) => {
        const updated = previous.map(
          (item) => ({ ...item })
        );

        updated[currentPlayer].rolls++;

        return updated;
      });

      setDice(aiRoll);

      setMessage(
        `🤖 ${players[currentPlayer].name} rolled ${aiRoll}`
      );

      const possible =
        movableTokens(
          currentPlayer,
          aiRoll
        );

      if (possible.length === 0) {
        setTimeout(() => {
          setDice(0);

          if (aiRoll !== 6) {
            setCurrentPlayer(
              (currentPlayer + 1) % 4
            );
          }
        }, 650);

        return;
      }

      /*
        SMART AI:
        1. Prefer tokens already moving.
        2. Prefer furthest token.
      */
      possible.sort(
        (a, b) =>
          b.position - a.position
      );

      const selected =
        possible[0];

      setTimeout(() => {
        moveToken(
          selected.index,
          aiRoll
        );
      }, demoMode ? 400 : 700);
    }, demoMode ? 500 : 900);

    return () => clearTimeout(timer);
  }, [
    currentPlayer,
    gameMode,
    gameOver,
    moving,
    dice,
    demoMode,
  ]);

  function changeGameMode(mode) {
    setGameMode(mode);

    setTokens([
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);

    setPowerUps([
      null,
      null,
      null,
      null,
    ]);

    setStats(
      players.map(() => ({
        rolls: 0,
        captures: 0,
        finished: 0,
      }))
    );

    setTotalMoves(0);
    setCurrentPlayer(0);
    setDice(0);
    setGameOver(false);
    setWinner(null);
    setRolling(false);
    setMoving(false);
    setMovingToken(null);
    setCapturedToken(null);
    setPowerPopup(null);

    setMessage(
      mode === "ai"
        ? "🤖 AI Battle selected. You are Red."
        : "👥 2 Player selected. Red starts!"
    );
  }

  function resetGame() {
    changeGameMode(gameMode);
  }

  function tokenStyle(
    playerIndex,
    position
  ) {
    const global =
      globalPosition(
        playerIndex,
        position
      );

    if (global === null) {
      return null;
    }

    const [row, col] =
      path[global];

    return {
      gridRow: row + 1,
      gridColumn: col + 1,
    };
  }

  return (
    <div className="app">

      {/* HEADER */}

      <header className="topbar">

        <div className="brand">

          <div className="brand-icon">
            🎲
          </div>

          <div>
            <h1>LudoX</h1>

            <span>
              Classic Ludo • Reimagined
            </span>
          </div>

        </div>

        <div className="header-actions">

          <button
            className="sound-btn"
            onClick={() => {
              setSoundOn(
                (previous) =>
                  !previous
              );

              if (!soundOn) {
                setTimeout(
                  () =>
                    playTone(
                      700,
                      0.1
                    ),
                  30
                );
              }
            }}
          >
            {soundOn
              ? "🔊 SOUND ON"
              : "🔇 SOUND OFF"}
          </button>

          <div className="turn-indicator">

            <span
              style={{
                background:
                  player.color,
              }}
            />

            {player.name}{" "}

            {isHumanTurn
              ? "YOUR TURN"
              : "AI TURN"}

          </div>

        </div>

      </header>

      {/* WINNER */}

      {gameOver &&
        winner !== null && (
          <div className="winner-overlay">

            <div
              className="winner-card"
              style={{
                "--winner-color":
                  players[winner].color,
              }}
            >

              <div className="confetti">
                🎊 ✨ 🎉 ✨ 🎊
              </div>

              <div className="trophy">
                🏆
              </div>

              <p className="winner-label">
                GAME OVER
              </p>

              <h1>
                {players[winner].name}
                <br />
                WINS!
              </h1>

              <p className="winner-subtitle">
                All 4 tokens reached
                home.
              </p>

              <div className="winner-stats">

                <div>
                  <strong>
                    {
                      stats[winner]
                        .rolls
                    }
                  </strong>

                  <span>
                    🎲 Rolls
                  </span>
                </div>

                <div>
                  <strong>
                    {
                      stats[winner]
                        .captures
                    }
                  </strong>

                  <span>
                    💥 Captures
                  </span>
                </div>

                <div>
                  <strong>
                    {
                      stats[winner]
                        .finished
                    }
                  </strong>

                  <span>
                    🏠 Tokens
                  </span>
                </div>

              </div>

              <button
                onClick={resetGame}
                className="play-again-btn"
              >
                🔄 PLAY AGAIN
              </button>

              <button
                onClick={() =>
                  changeGameMode(
                    gameMode === "ai"
                      ? "2p"
                      : "ai"
                  )
                }
                className="change-mode-btn"
              >
                🎮 CHANGE MODE
              </button>

            </div>

          </div>
        )}

      {/* POWER POPUP */}

      {powerPopup && (
        <div className="power-popup">

          <div className="power-popup-icon">
            {powerPopup.icon}
          </div>

          <div>

            <strong>
              {powerPopup.name}
            </strong>

            <span>
              {powerPopup.player}
            </span>

            <p>
              {powerPopup.description}
            </p>

          </div>

        </div>
      )}

      <main className="game-layout">

        {/* BOARD */}

        <section className="board-wrapper">

          <div className="ludo-board">

            <div className="home-area red-home">

              <h2>RED</h2>

              <div className="yard">

                {[0, 1, 2, 3].map(
                  (index) => (
                    <button
                      key={index}
                      className={`yard-token ${
                        legalTokens.includes(
                          index
                        )
                          ? "token-legal"
                          : ""
                      }`}
                      style={{
                        color:
                          players[0].dark,
                        borderColor:
                          players[0].dark,
                      }}
                      disabled={
                        currentPlayer !==
                          0 ||
                        dice !== 6 ||
                        moving
                      }
                      onClick={() =>
                        moveToken(index)
                      }
                    >
                      {index + 1}
                    </button>
                  )
                )}

              </div>

            </div>

            <div className="home-area green-home">

              <h2>GREEN</h2>

              <div className="yard">

                {[0, 1, 2, 3].map(
                  (index) => (
                    <div
                      key={index}
                      className="yard-token"
                      style={{
                        color:
                          players[1].dark,
                        borderColor:
                          players[1].dark,
                      }}
                    >
                      {index + 1}
                    </div>
                  )
                )}

              </div>

            </div>

            <div className="home-area yellow-home">

              <h2>YELLOW</h2>

              <div className="yard">

                {[0, 1, 2, 3].map(
                  (index) => (
                    <div
                      key={index}
                      className="yard-token"
                      style={{
                        color:
                          players[2].dark,
                        borderColor:
                          players[2].dark,
                      }}
                    >
                      {index + 1}
                    </div>
                  )
                )}

              </div>

            </div>

            <div className="home-area blue-home">

              <h2>BLUE</h2>

              <div className="yard">

                {[0, 1, 2, 3].map(
                  (index) => (
                    <div
                      key={index}
                      className="yard-token"
                      style={{
                        color:
                          players[3].dark,
                        borderColor:
                          players[3].dark,
                      }}
                    >
                      {index + 1}
                    </div>
                  )
                )}

              </div>

            </div>

            {path.map(
              ([row, col], index) => {
                const isSafe =
                  safeCells.includes(
                    index
                  );

                const isPower =
                  powerCells.includes(
                    index
                  );

                return (
                  <div
                    key={`cell-${index}`}
                    className={`path-cell ${
                      isSafe
                        ? "safe-cell"
                        : ""
                    } ${
                      isPower
                        ? "power-cell"
                        : ""
                    }`}
                    style={{
                      gridRow:
                        row + 1,
                      gridColumn:
                        col + 1,
                    }}
                  >
                    {isPower
                      ? "⚡"
                      : isSafe
                      ? "★"
                      : ""}
                  </div>
                );
              }
            )}

            <div className="center-home">
              <div className="center-red" />
              <div className="center-green" />
              <div className="center-yellow" />
              <div className="center-blue" />

              <div className="center-star">
                ★
              </div>
            </div>

            {tokens.map(
              (
                playerTokens,
                playerIndex
              ) =>
                playerTokens.map(
                  (
                    position,
                    tokenIndex
                  ) => {
                    const style =
                      tokenStyle(
                        playerIndex,
                        position
                      );

                    if (!style) {
                      return null;
                    }

                    const isMoving =
                      movingToken?.player ===
                        playerIndex &&
                      movingToken?.token ===
                        tokenIndex;

                    const isCaptured =
                      capturedToken?.player ===
                        playerIndex &&
                      capturedToken?.token ===
                        tokenIndex;

                    const isLegal =
                      playerIndex ===
                        currentPlayer &&
                      legalTokens.includes(
                        tokenIndex
                      ) &&
                      isHumanTurn &&
                      !moving;

                    return (
                      <button
                        key={`${playerIndex}-${tokenIndex}`}
                        className={`board-token ${
                          isMoving
                            ? "token-moving"
                            : ""
                        } ${
                          isCaptured
                            ? "token-captured"
                            : ""
                        } ${
                          isLegal
                            ? "token-legal"
                            : ""
                        }`}
                        style={{
                          ...style,
                          background:
                            players[
                              playerIndex
                            ].color,
                        }}
                        disabled={
                          !isLegal
                        }
                        onClick={() =>
                          moveToken(
                            tokenIndex
                          )
                        }
                      >
                        {tokenIndex + 1}
                      </button>
                    );
                  }
                )
            )}

          </div>

        </section>

        {/* SIDE PANEL */}

        <aside className="side-panel">

          <div className="player-title">

            <span
              className="player-dot"
              style={{
                background:
                  player.color,
              }}
            />

            {player.name}

            {isHumanTurn && (
              <small>
                YOUR TURN
              </small>
            )}

          </div>

          {/* MODE */}

          <div className="mode-section">

            <h3>GAME MODE</h3>

            <div className="mode-buttons">

              <button
                className={`mode-btn ${
                  gameMode === "ai"
                    ? "mode-active"
                    : ""
                }`}
                onClick={() =>
                  changeGameMode("ai")
                }
              >

                <span>🤖</span>

                <div>
                  <strong>
                    AI BATTLE
                  </strong>

                  <small>
                    1 Player
                  </small>
                </div>

              </button>

              <button
                className={`mode-btn ${
                  gameMode === "2p"
                    ? "mode-active"
                    : ""
                }`}
                onClick={() =>
                  changeGameMode("2p")
                }
              >

                <span>👥</span>

                <div>
                  <strong>
                    2 PLAYER
                  </strong>

                  <small>
                    Local
                  </small>
                </div>

              </button>

            </div>

          </div>

          {/* DEMO */}

          <div className="demo-control">

            <div>
              <strong>
                🧪 DEMO MODE
              </strong>

              <small>
                More sixes + faster AI
              </small>
            </div>

            <button
              className={`toggle ${
                demoMode
                  ? "toggle-on"
                  : ""
              }`}
              onClick={() =>
                setDemoMode(
                  (previous) =>
                    !previous
                )
              }
            >
              <span />
            </button>

          </div>

          {/* DICE */}

          <div
            className={`dice-display ${
              rolling
                ? "dice-rolling"
                : ""
            }`}
          >
            {dice === 0
              ? "🎲"
              : [
                  "⚀",
                  "⚁",
                  "⚂",
                  "⚃",
                  "⚄",
                  "⚅",
                ][dice - 1]}
          </div>

          <button
            className="roll-btn"
            onClick={rollDice}
            disabled={
              rolling ||
              moving ||
              gameOver ||
              !isHumanTurn
            }
          >
            🎲 ROLL DICE
          </button>

          <div className="game-message">
            {message}
          </div>

          {/* STATS */}

          <div className="live-stats">

            <div className="stats-title">
              📊 LIVE STATS
            </div>

            <div className="stat-grid">

              <div className="stat-box">
                <strong>
                  {totalMoves}
                </strong>

                <span>
                  Moves
                </span>
              </div>

              <div className="stat-box">
                <strong>
                  {stats.reduce(
                    (sum, item) =>
                      sum + item.rolls,
                    0
                  )}
                </strong>

                <span>
                  Rolls
                </span>
              </div>

              <div className="stat-box">
                <strong>
                  {stats.reduce(
                    (sum, item) =>
                      sum +
                      item.captures,
                    0
                  )}
                </strong>

                <span>
                  Captures
                </span>
              </div>

              <div className="stat-box">
                <strong>
                  {stats.reduce(
                    (sum, item) =>
                      sum +
                      item.finished,
                    0
                  )}
                </strong>

                <span>
                  Home
                </span>
              </div>

            </div>

          </div>

          {/* POWER */}

          <div className="power-card">

            <strong>
              ⚡ POWER TILES
            </strong>

            <p>
              Land here to unlock
              abilities.
            </p>

            <div className="power-list">

              <span>
                ⚡ +2 BOOST
              </span>

              <span>
                🛡️ SHIELD
              </span>

              <span>
                🎯 EXTRA TURN
              </span>

            </div>

          </div>

          {/* PLAYERS */}

          <div className="players">

            <h3>PLAYERS</h3>

            {players.map(
              (item, index) => {

                const inactive =
                  gameMode === "2p" &&
                  index > 1;

                return (
                  <div
                    className={`player-row ${
                      index ===
                      currentPlayer
                        ? "player-active"
                        : ""
                    } ${
                      inactive
                        ? "player-inactive"
                        : ""
                    }`}
                    key={item.name}
                  >

                    <span
                      className="player-color"
                      style={{
                        background:
                          item.color,
                      }}
                    />

                    <span>
                      {item.name}
                    </span>

                    {!inactive && (
                      <span className="player-mini-stats">
                        💥{" "}
                        {
                          stats[index]
                            .captures
                        }
                        {"  "}
                        🏠{" "}
                        {
                          stats[index]
                            .finished
                        }
                      </span>
                    )}

                    {!inactive &&
                      index ===
                        currentPlayer && (
                        <b>
                          TURN
                        </b>
                      )}

                  </div>
                );
              }
            )}

          </div>

          <button
            className="new-game-btn"
            onClick={resetGame}
          >
            🔄 NEW GAME
          </button>

        </aside>

      </main>

      <footer className="footer">

        <span>
          🎲 LudoX
        </span>

        <span>
          Open Source Community Project
        </span>

      </footer>

    </div>
  );
}

export default App;
