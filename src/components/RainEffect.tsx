import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  length: number;
  opacity: number;
}

export const RainEffect = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouseMove);

    // Initialize particles
    const particleCount = 200;
    for (let i = 0; i < particleCount; i++) {
      particlesRef.current.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: Math.random() * 4 + 3,
        length: Math.random() * 25 + 15,
        opacity: Math.random() * 0.4 + 0.3,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const mouseX = mouseRef.current.x;
      const mouseY = mouseRef.current.y;
      const avoidRadius = 120;

      particlesRef.current.forEach((particle) => {
        // Calculate distance to mouse
        const dx = particle.x - mouseX;
        const dy = particle.y - mouseY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Avoid mouse cursor with stronger force
        if (distance < avoidRadius) {
          const angle = Math.atan2(dy, dx);
          const force = (avoidRadius - distance) / avoidRadius;
          particle.vx += Math.cos(angle) * force * 1.2;
          particle.vy += Math.sin(angle) * force * 0.8;
        }

        // Apply velocity
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Dampen horizontal movement
        particle.vx *= 0.92;

        // Reset gravity
        if (particle.vy < 3) particle.vy += 0.2;

        // Wrap around screen
        if (particle.y > canvas.height) {
          particle.y = -particle.length;
          particle.x = Math.random() * canvas.width;
          particle.vy = Math.random() * 4 + 3;
        }
        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;

        // Draw particle with gradient
        const gradient = ctx.createLinearGradient(
          particle.x, 
          particle.y, 
          particle.x + particle.vx * 2, 
          particle.y + particle.length
        );
        gradient.addColorStop(0, `rgba(220, 150, 80, ${particle.opacity})`);
        gradient.addColorStop(1, `rgba(220, 150, 80, 0)`);
        
        ctx.beginPath();
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1.5;
        ctx.moveTo(particle.x, particle.y);
        ctx.lineTo(particle.x + particle.vx * 2, particle.y + particle.length);
        ctx.stroke();
      });

      requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.6 }}
    />
  );
};
