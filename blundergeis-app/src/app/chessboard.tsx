"use client";

import { useChessGame } from "../hooks/use-chess-game";
import { ChessBoard } from "../components/chess-board";

const App = () => {
  const { fen, makeMove, bestMove, evaluation } = useChessGame();

  return (
    <div>
      <h1>Chess Game with Stockfish</h1>
      <ChessBoard position={fen} onPieceDrop={makeMove} boardWidth={500} />
      <div>
        <h3>Best Move: {bestMove || "Calculating..."}</h3>
        <h3>Evaluation: {evaluation !== "" ? String(evaluation) : "Evaluating..."}</h3>
      </div>
    </div>
  );
};

export default App;
