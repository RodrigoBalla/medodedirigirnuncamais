import { useState } from "react";

interface GifIllustrationProps {
  gifId: string;
  alt: string;
  emoji: string;
}

export function GifIllustration({ gifId, alt, emoji }: GifIllustrationProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const sources = [
    `https://media2.giphy.com/media/${gifId}/giphy.gif`,
    `https://media1.giphy.com/media/${gifId}/giphy.gif`,
    `https://media0.giphy.com/media/${gifId}/giphy.gif`,
    `https://media3.giphy.com/media/${gifId}/giphy.gif`,
  ];
  const [srcIndex, setSrcIndex] = useState(0);

  function handleError() {
    if (srcIndex < sources.length - 1) {
      setSrcIndex(i => i + 1);
    } else {
      setError(true);
    }
  }

  return (
    <div className="quiz-gif-wrapper">
      {!error ? (
        <>
          {!loaded && (
            <div className="quiz-gif-skeleton">
              <span>{emoji}</span>
            </div>
          )}
          <img
            src={sources[srcIndex]}
            alt={alt}
            onLoad={() => setLoaded(true)}
            onError={handleError}
            style={{ display: loaded ? "block" : "none" }}
          />
        </>
      ) : (
        <div className="quiz-gif-fallback">
          <span className="fallback-emoji">{emoji}</span>
          <span className="fallback-text">{alt}</span>
        </div>
      )}
      <div className="quiz-gif-label">✨ ilustração</div>
    </div>
  );
}
