import React, { useEffect, useRef } from 'react';

export function VoiceVisualizer({ stream }: { stream: MediaStream | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!stream || !containerRef.current) return;
    
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    
    analyser.fftSize = 64;
    source.connect(analyser);
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    let animationId: number;
    const bars = Array.from(containerRef.current.children) as HTMLElement[];
    const numBars = bars.length;
    const step = Math.floor(bufferLength / numBars);
    
    const draw = () => {
      analyser.getByteFrequencyData(dataArray);
      
      for (let i = 0; i < numBars; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) {
          sum += dataArray[i * step + j];
        }
        const average = sum / step;
        
        // Map average (0-255) to a height (min 6px, max 48px)
        const height = Math.max(6, (average / 255) * 48);
        bars[i].style.height = `${height}px`;
      }
      
      animationId = requestAnimationFrame(draw);
    };
    
    draw();
    
    return () => {
      cancelAnimationFrame(animationId);
      audioContext.close().catch(console.error);
    };
  }, [stream]);

  return (
    <div ref={containerRef} className="flex items-center justify-center gap-1.5 h-12 w-48">
      {Array.from({ length: 12 }).map((_, i) => (
        <div 
          key={i} 
          className="w-1.5 bg-rose-500 rounded-full transition-all duration-75 ease-out" 
          style={{ height: '6px' }}
        />
      ))}
    </div>
  );
}
