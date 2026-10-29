import confetti from 'canvas-confetti'

export function triggerConfetti() {
  try {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#10b981', '#34d399', '#059669', '#3b82f6', '#f59e0b'],
    })
  } catch {
    // Graceful fallback if canvas is unsupported
  }
}

export function triggerCelebration() {
  try {
    const end = Date.now() + 1500
    const frame = () => {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#10b981', '#34d399', '#3b82f6'],
      })
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#10b981', '#34d399', '#3b82f6'],
      })
      if (Date.now() < end) {
        requestAnimationFrame(frame)
      }
    }
    frame()
  } catch {
    // Fallback
  }
}

