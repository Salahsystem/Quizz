import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import io from "socket.io-client";
import axios from "axios";
import "./App.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// WebSocket connection
let socket = null;

const HostPage = () => {
  const [qrCode, setQrCode] = useState("");
  const [quizState, setQuizState] = useState({ status: "waiting", players: [] });
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchQRCode();
    fetchQuizState();
    
    // Connect to WebSocket
    socket = io(BACKEND_URL);
    
    socket.on("connect", () => {
      console.log("Connected to server");
    });
    
    socket.on("questions_loaded", (data) => {
      setQuestions(data.questions);
      alert(`Successfully loaded ${data.count} questions!`);
    });
    
    socket.on("player_joined", (data) => {
      setQuizState(prev => ({ ...prev, players: data.players }));
    });
    
    socket.on("player_left", (data) => {
      setQuizState(prev => ({ ...prev, players: data.players }));
    });
    
    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  const fetchQRCode = async () => {
    try {
      const response = await axios.get(`${API}/qr-code`);
      setQrCode(response.data.qr_code);
    } catch (error) {
      console.error("Error fetching QR code:", error);
    }
  };

  const fetchQuizState = async () => {
    try {
      const response = await axios.get(`${API}/quiz-state`);
      setQuizState(response.data);
    } catch (error) {
      console.error("Error fetching quiz state:", error);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    try {
      await axios.post(`${API}/upload-excel`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
    } catch (error) {
      alert("Error uploading file: " + error.response?.data?.detail);
    }
    setLoading(false);
  };

  const downloadTemplate = async () => {
    try {
      const response = await axios.get(`${API}/template-excel`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'quiz_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Error downloading template:", error);
    }
  };

  const startQuiz = async () => {
    try {
      await axios.post(`${API}/start-quiz`);
      setQuizState(prev => ({ ...prev, status: "active" }));
    } catch (error) {
      alert("Error starting quiz: " + error.response?.data?.detail);
    }
  };

  const nextQuestion = async () => {
    try {
      await axios.post(`${API}/next-question`);
    } catch (error) {
      alert("Error going to next question: " + error.response?.data?.detail);
    }
  };

  const pauseQuiz = async () => {
    try {
      await axios.post(`${API}/pause-quiz`);
      setQuizState(prev => ({ ...prev, status: "paused" }));
    } catch (error) {
      alert("Error pausing quiz: " + error.response?.data?.detail);
    }
  };

  const resumeQuiz = async () => {
    try {
      await axios.post(`${API}/resume-quiz`);
      setQuizState(prev => ({ ...prev, status: "active" }));
    } catch (error) {
      alert("Error resuming quiz: " + error.response?.data?.detail);
    }
  };

  const sortedPlayers = [...quizState.players].sort((a, b) => b.score - a.score);

  return (
    <div className="host-container">
      <div className="host-header">
        <h1>🎯 Quiz Familial - Interface Hôte</h1>
      </div>

      <div className="host-content">
        <div className="host-section">
          <h2>📱 Code QR pour rejoindre</h2>
          {qrCode && (
            <div className="qr-section">
              <img src={qrCode} alt="QR Code" className="qr-code" />
              <p>Scannez ce code avec votre téléphone pour rejoindre le quiz</p>
            </div>
          )}
        </div>

        <div className="host-section">
          <h2>📋 Gestion des questions</h2>
          <div className="file-controls">
            <button onClick={downloadTemplate} className="btn btn-secondary">
              📥 Télécharger modèle Excel
            </button>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="file-input"
              disabled={loading}
            />
            {loading && <span className="loading">Chargement...</span>}
          </div>
          {questions.length > 0 && (
            <p className="questions-info">✅ {questions.length} questions chargées</p>
          )}
        </div>

        <div className="host-section">
          <h2>🎮 Contrôles du quiz</h2>
          <div className="quiz-controls">
            {quizState.status === "waiting" && (
              <button 
                onClick={startQuiz} 
                className="btn btn-primary"
                disabled={questions.length === 0}
              >
                🚀 Démarrer le quiz
              </button>
            )}
            
            {quizState.status === "active" && (
              <>
                <button onClick={nextQuestion} className="btn btn-primary">
                  ➡️ Question suivante
                </button>
                <button onClick={pauseQuiz} className="btn btn-warning">
                  ⏸️ Pause
                </button>
              </>
            )}
            
            {quizState.status === "paused" && (
              <button onClick={resumeQuiz} className="btn btn-success">
                ▶️ Reprendre
              </button>
            )}
          </div>
          <div className="quiz-status">
            Statut: <span className={`status ${quizState.status}`}>{quizState.status}</span>
          </div>
        </div>

        <div className="host-section">
          <h2>🏆 Classement en temps réel</h2>
          <div className="leaderboard">
            {sortedPlayers.length === 0 ? (
              <p className="no-players">Aucun joueur connecté</p>
            ) : (
              <div className="players-list">
                {sortedPlayers.map((player, index) => (
                  <div key={player.id} className={`player-item rank-${index + 1}`}>
                    <span className="rank">#{index + 1}</span>
                    <span className="name">{player.name}</span>
                    <span className="score">{player.score} pts</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const JoinPage = () => {
  const [playerName, setPlayerName] = useState("");
  const [gameState, setGameState] = useState("name_entry"); // name_entry, lobby, playing, finished
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [playerScore, setPlayerScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [hasAnswered, setHasAnswered] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    socket = io(BACKEND_URL);
    
    socket.on("connect", () => {
      console.log("Connected to server");
    });

    socket.on("quiz_started", () => {
      setGameState("playing");
    });

    socket.on("question", (data) => {
      setCurrentQuestion(data.question);
      setTimeLeft(data.question.duration);
      setHasAnswered(false);
      setFeedback(null);
      
      // Start countdown
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    });

    socket.on("answer_feedback", (data) => {
      setFeedback(data);
      setPlayerScore(data.score);
    });

    socket.on("quiz_finished", (data) => {
      setGameState("finished");
    });

    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  const joinGame = () => {
    if (playerName.trim()) {
      socket.emit("join_player", { name: playerName.trim() });
      setGameState("lobby");
    }
  };

  const submitAnswer = (answer) => {
    if (!hasAnswered && timeLeft > 0) {
      setHasAnswered(true);
      socket.emit("submit_answer", { answer });
    }
  };

  if (gameState === "name_entry") {
    return (
      <div className="join-container">
        <div className="join-card">
          <h1>🎯 Quiz Familial</h1>
          <div className="name-entry">
            <h2>Entrez votre prénom</h2>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Votre prénom..."
              className="name-input"
              onKeyPress={(e) => e.key === 'Enter' && joinGame()}
            />
            <button onClick={joinGame} className="btn btn-primary">
              🚀 Rejoindre le quiz
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === "lobby") {
    return (
      <div className="join-container">
        <div className="lobby-card">
          <h1>🎯 Quiz Familial</h1>
          <h2>Bienvenue {playerName}!</h2>
          <div className="lobby-info">
            <div className="waiting-animation">
              <div className="spinner"></div>
              <p>En attente du début du quiz...</p>
            </div>
            <p>Score actuel: <span className="score">{playerScore} points</span></p>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === "playing" && currentQuestion) {
    return (
      <div className="join-container">
        <div className="question-card">
          <div className="question-header">
            <div className="timer">⏱️ {timeLeft}s</div>
            <div className="score">🏆 {playerScore} pts</div>
          </div>
          
          <h2 className="question-text">{currentQuestion.question}</h2>
          <div className="points-info">💎 {currentQuestion.points} points</div>
          
          <div className="options">
            {[
              { key: "A", text: currentQuestion.option_a },
              { key: "B", text: currentQuestion.option_b },
              { key: "C", text: currentQuestion.option_c },
              { key: "D", text: currentQuestion.option_d }
            ].map(option => (
              <button
                key={option.key}
                onClick={() => submitAnswer(option.key)}
                className={`option-btn ${hasAnswered ? 'disabled' : ''} ${
                  feedback && feedback.correct_answer === option.key ? 'correct' : ''
                } ${
                  feedback && !feedback.correct && hasAnswered ? 'incorrect' : ''
                }`}
                disabled={hasAnswered || timeLeft === 0}
              >
                <span className="option-letter">{option.key}</span>
                <span className="option-text">{option.text}</span>
              </button>
            ))}
          </div>

          {feedback && (
            <div className={`feedback ${feedback.correct ? 'correct' : 'incorrect'}`}>
              {feedback.correct ? "✅ Bonne réponse!" : `❌ Mauvaise réponse. La bonne réponse était ${feedback.correct_answer}`}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (gameState === "finished") {
    return (
      <div className="join-container">
        <div className="finished-card">
          <h1>🎉 Quiz terminé!</h1>
          <h2>Merci {playerName}!</h2>
          <div className="final-score">
            <p>Score final: <span className="score">{playerScore} points</span></p>
          </div>
          <button onClick={() => navigate("/")} className="btn btn-primary">
            🏠 Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="join-container">
      <div className="join-card">
        <h1>🎯 Quiz Familial</h1>
        <p>Chargement...</p>
      </div>
    </div>
  );
};

const HomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="home-container">
      <div className="home-card">
        <h1>🎯 Quiz Familial</h1>
        <p className="subtitle">Amusez-vous en famille avec des quiz personnalisés!</p>
        
        <div className="home-buttons">
          <button onClick={() => navigate("/host")} className="btn btn-primary">
            🖥️ Interface Hôte
          </button>
          <button onClick={() => navigate("/join")} className="btn btn-secondary">
            📱 Rejoindre le quiz
          </button>
        </div>
        
        <div className="features">
          <div className="feature">
            <span className="feature-icon">📊</span>
            <p>Chargez vos questions depuis Excel</p>
          </div>
          <div className="feature">
            <span className="feature-icon">📱</span>
            <p>Jouez depuis votre téléphone</p>
          </div>
          <div className="feature">
            <span className="feature-icon">🏆</span>
            <p>Classement en temps réel</p>
          </div>
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/host" element={<HostPage />} />
          <Route path="/join" element={<JoinPage />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;